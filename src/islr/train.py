"""Train the sign classifier on the cached landmarks and score it on held-out signers.

Writes to ``--out`` (default models/run): ``weights.pt``, ``history.json``, ``metrics.json`` and
``val_predictions.npz``. ``python -m islr.track`` then records the run in MLflow, so a run trained on
Kaggle and a run trained here are tracked the same way.

    uv run python -m islr.train --epochs 1 --limit 512     # smoke run
"""

from __future__ import annotations

import argparse
import json
import math
import time
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset, get_worker_info

from islr.augment import augment
from islr.config import Config, load_config
from islr.data import load_cache, sign_map
from islr.features import Preprocess
from islr.model import SignModel


def split(index: pd.DataFrame, valid_participants: list[int]) -> tuple[np.ndarray, np.ndarray]:
    is_val = index.participant_id.isin(valid_participants).to_numpy()
    return np.flatnonzero(~is_val), np.flatnonzero(is_val)


class SignDataset(Dataset):
    def __init__(self, points: np.ndarray, index: pd.DataFrame, rows: np.ndarray, max_len: int, train: bool):
        self.points = points
        self.start = index.start.to_numpy()[rows]
        self.length = index.length.to_numpy()[rows]
        self.label = index.label.to_numpy()[rows]
        self.pre = Preprocess(max_len)
        self.train = train
        self.rng = np.random.default_rng(0)

    def __len__(self) -> int:
        return len(self.label)

    def __getitem__(self, i: int) -> tuple[torch.Tensor, int]:
        s = int(self.start[i])
        x = np.asarray(self.points[s : s + int(self.length[i])], dtype=np.float32)
        if self.train:
            x = augment(x, self.rng)
        with torch.no_grad():
            feats = self.pre.featurize(torch.from_numpy(x))
        return feats, int(self.label[i])


def _worker_init(_: int) -> None:
    info = get_worker_info()
    torch.set_num_threads(1)
    if info is not None and isinstance(info.dataset, SignDataset):
        info.dataset.rng = np.random.default_rng(torch.initial_seed() % 2**32)


def collate(batch: list[tuple[torch.Tensor, int]]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    n = max(f.shape[0] for f, _ in batch)
    x = torch.zeros(len(batch), n, batch[0][0].shape[1])
    mask = torch.zeros(len(batch), n, dtype=torch.bool)
    for j, (f, _) in enumerate(batch):
        x[j, : len(f)] = f
        mask[j, : len(f)] = True
    return x, mask, torch.tensor([y for _, y in batch])


def build_model(cfg: Config, n_classes: int = 250) -> SignModel:
    return SignModel(n_classes=n_classes, **cfg.model.model_dump())


@torch.no_grad()
def predict(model: torch.nn.Module, loader: DataLoader, device: torch.device, amp: bool) -> np.ndarray:
    model.eval()
    out = []
    for x, mask, _ in loader:
        with torch.autocast(device.type, dtype=torch.float16, enabled=amp and device.type == "cuda"):
            out.append(model(x.to(device), mask.to(device)).float().softmax(-1).cpu().numpy())
    return np.concatenate(out)


def topk_accuracy(probs: np.ndarray, y: np.ndarray, k: int) -> float:
    top = np.argsort(-probs, axis=1)[:, :k]
    return float((top == y[:, None]).any(axis=1).mean())


def summarise(probs: np.ndarray, y: np.ndarray, signs: list[str]) -> dict[str, Any]:
    """Top-1/top-5 accuracy, per-sign accuracy and the most frequent confusions."""
    pred = probs.argmax(1)
    per_sign = {signs[c]: float((pred[y == c] == c).mean()) for c in np.unique(y)}
    pairs: dict[tuple[int, int], int] = {}
    for t, p in zip(y[pred != y], pred[pred != y], strict=True):
        pairs[(int(t), int(p))] = pairs.get((int(t), int(p)), 0) + 1
    top_conf = sorted(pairs.items(), key=lambda kv: -kv[1])[:15]
    return {
        "top1": float((pred == y).mean()),
        "top5": topk_accuracy(probs, y, 5),
        "n": len(y),
        "per_sign": per_sign,
        "confusions": [
            {"true": signs[t], "pred": signs[p], "count": c, "of": int((y == t).sum())}
            for (t, p), c in top_conf
        ],
    }


def lr_lambda(warmup: int, total: int) -> Any:
    def f(step: int) -> float:
        if step < warmup:
            return (step + 1) / warmup
        return 0.5 * (1 + math.cos(math.pi * min(1.0, (step - warmup) / max(1, total - warmup))))

    return f


def train(
    cfg: Config,
    out: Path,
    epochs: int | None = None,
    workers: int | None = None,
    limit: int | None = None,
    device_name: str | None = None,
) -> dict[str, Any]:
    t0 = time.perf_counter()
    tc = cfg.train
    epochs = epochs or tc.epochs
    workers = tc.num_workers if workers is None else workers
    torch.manual_seed(tc.seed)
    np.random.seed(tc.seed)  # noqa: NPY002 - seeds any library code that uses the global state
    device = torch.device(device_name or ("cuda" if torch.cuda.is_available() else "cpu"))
    amp = tc.amp and device.type == "cuda"

    points, index = load_cache(cfg.paths.cache)
    tr, va = split(index, cfg.valid_participants)
    if limit:
        rng = np.random.default_rng(tc.seed)
        tr = np.sort(rng.permutation(tr)[:limit])
        va = np.sort(rng.permutation(va)[: max(1, limit // 4)])
    signs = [s for s, _ in sorted(sign_map(cfg.paths.raw).items(), key=lambda kv: kv[1])]

    kw: dict[str, Any] = dict(
        batch_size=tc.batch_size, collate_fn=collate, num_workers=workers, worker_init_fn=_worker_init
    )
    if workers > 0:
        kw["persistent_workers"] = True
    train_dl = DataLoader(
        SignDataset(points, index, tr, cfg.max_len, True), shuffle=True, drop_last=True, **kw
    )
    val_dl = DataLoader(SignDataset(points, index, va, cfg.max_len, False), **kw)
    if len(train_dl) == 0:
        raise ValueError("not enough training sequences for one batch")

    model = build_model(cfg, len(signs)).to(device)
    decay = [p for n, p in model.named_parameters() if p.ndim > 1]
    no_decay = [p for n, p in model.named_parameters() if p.ndim <= 1]
    opt = torch.optim.AdamW(
        [{"params": decay, "weight_decay": tc.weight_decay}, {"params": no_decay, "weight_decay": 0.0}],
        lr=tc.lr,
    )
    steps = epochs * len(train_dl)
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lr_lambda(tc.warmup_epochs * len(train_dl), steps))
    scaler = torch.amp.GradScaler(device.type, enabled=amp)
    y_val = index.label.to_numpy()[va]

    history = []
    for ep in range(1, epochs + 1):
        model.train()
        te, tot, seen = time.perf_counter(), 0.0, 0
        for x, mask, y in train_dl:
            x, mask, y = x.to(device), mask.to(device), y.to(device)
            with torch.autocast(device.type, dtype=torch.float16, enabled=amp):
                loss = F.cross_entropy(model(x, mask), y, label_smoothing=tc.label_smoothing)
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(opt)
            scaler.update()
            sched.step()
            tot += float(loss.detach()) * len(y)
            seen += len(y)
        row: dict[str, Any] = {"epoch": ep, "train_loss": tot / seen, "lr": sched.get_last_lr()[0]}
        if ep == epochs or ep % 5 == 0:
            probs = predict(model, val_dl, device, amp)
            row |= {
                "val_top1": float((probs.argmax(1) == y_val).mean()),
                "val_top5": topk_accuracy(probs, y_val, 5),
            }
        row["seconds"] = round(time.perf_counter() - te, 1)
        history.append(row)
        print(json.dumps(row), flush=True)

    probs = predict(model, val_dl, device, amp)
    out.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), out / "weights.pt")
    np.savez_compressed(
        out / "val_predictions.npz",
        sequence_id=index.sequence_id.to_numpy()[va],
        label=y_val,
        top5=np.argsort(-probs, axis=1)[:, :5].astype(np.int16),
        top5_prob=-np.sort(-probs, axis=1)[:, :5].astype(np.float32),
    )
    metrics = summarise(probs, y_val, signs)
    params = sum(p.numel() for p in model.parameters())
    result = {
        "metrics": metrics,
        "history": history,
        "params": {
            **cfg.model.model_dump(),
            **{k: v for k, v in tc.model_dump().items() if k != "num_workers"},
            "epochs": epochs,
            "max_len": cfg.max_len,
            "valid_participants": cfg.valid_participants,
            "train_sequences": len(tr),
            "valid_sequences": len(va),
            "parameters": params,
        },
        "device": torch.cuda.get_device_name(device) if device.type == "cuda" else "cpu",
        "minutes": round((time.perf_counter() - t0) / 60, 1),
    }
    (out / "metrics.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"valid top-1 {metrics['top1']:.4f}, top-5 {metrics['top5']:.4f} ({result['minutes']} min)")
    return result


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", default=None)
    ap.add_argument("--out", default=None)
    ap.add_argument("--epochs", type=int, default=None)
    ap.add_argument("--workers", type=int, default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--device", default=None)
    a = ap.parse_args()
    cfg = load_config(a.config)
    out = Path(a.out) if a.out else cfg.paths.models / "run"
    train(cfg, out, a.epochs, a.workers, a.limit, a.device)


if __name__ == "__main__":
    main()
