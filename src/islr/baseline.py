"""Baselines on the same split: the most frequent sign, and a "bag of frames" MLP.

The MLP sees the same features as the main model, averaged over time (mean and standard deviation of
each feature), so it knows which hand shapes and positions occur but not in what order. The gap
between it and the main model is what temporal modelling is worth.

    uv run python -m islr.baseline --out models/run
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn.functional as F
from torch import nn

from islr.config import Config, load_config
from islr.data import load_cache
from islr.features import Preprocess
from islr.train import split, topk_accuracy


@torch.no_grad()
def pooled_features(points: np.ndarray, starts: np.ndarray, lengths: np.ndarray, max_len: int) -> np.ndarray:
    pre = Preprocess(max_len)
    out = []
    for s, n in zip(starts, lengths, strict=True):
        f = pre.featurize(torch.from_numpy(np.asarray(points[s : s + n], dtype=np.float32)))
        out.append(torch.cat([f.mean(0), f.std(0, unbiased=False)]).numpy())
    return np.stack(out).astype(np.float32)


def run(cfg: Config, out: Path, limit: int | None = None, device_name: str | None = None) -> dict[str, Any]:
    t0 = time.perf_counter()
    bc = cfg.baseline
    torch.manual_seed(cfg.train.seed)
    device = torch.device(device_name or ("cuda" if torch.cuda.is_available() else "cpu"))
    points, index = load_cache(cfg.paths.cache)
    tr, va = split(index, cfg.valid_participants)
    if limit:
        rng = np.random.default_rng(cfg.train.seed)
        tr = np.sort(rng.permutation(tr)[:limit])
        va = np.sort(rng.permutation(va)[: max(1, limit // 4)])
    y = index.label.to_numpy()
    n_classes = 250
    majority = int(np.bincount(y[tr], minlength=n_classes).argmax())
    majority_top1 = float((y[va] == majority).mean())

    feats = pooled_features(points, index.start.to_numpy(), index.length.to_numpy(), cfg.max_len)
    mu, sd = feats[tr].mean(0), feats[tr].std(0) + 1e-6
    xt = torch.from_numpy((feats[tr] - mu) / sd).to(device)
    xv = torch.from_numpy((feats[va] - mu) / sd).to(device)
    yt = torch.from_numpy(y[tr]).to(device)

    mlp = nn.Sequential(
        nn.Linear(xt.shape[1], bc.hidden), nn.GELU(), nn.Dropout(0.4),
        nn.Linear(bc.hidden, bc.hidden), nn.GELU(), nn.Dropout(0.4),
        nn.Linear(bc.hidden, n_classes),
    ).to(device)  # fmt: skip
    opt = torch.optim.AdamW(mlp.parameters(), lr=bc.lr, weight_decay=0.01)
    batch = 256
    for _ in range(bc.epochs):
        mlp.train()
        perm = torch.randperm(len(xt), device=device)
        for i in range(0, len(perm), batch):
            j = perm[i : i + batch]
            loss = F.cross_entropy(mlp(xt[j]), yt[j], label_smoothing=0.1)
            opt.zero_grad()
            loss.backward()
            opt.step()
    mlp.eval()
    with torch.no_grad():
        probs = mlp(xv).softmax(-1).cpu().numpy()
    result = {
        "majority_top1": majority_top1,
        "majority_sign_index": majority,
        "bag_of_frames_top1": float((probs.argmax(1) == y[va]).mean()),
        "bag_of_frames_top5": topk_accuracy(probs, y[va], 5),
        "params": {"epochs": bc.epochs, "hidden": bc.hidden, "lr": bc.lr, "features": int(xt.shape[1])},
        "minutes": round((time.perf_counter() - t0) / 60, 1),
    }
    out.mkdir(parents=True, exist_ok=True)
    (out / "baseline.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "params"}))
    return result


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", default=None)
    ap.add_argument("--out", default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--device", default=None)
    a = ap.parse_args()
    cfg = load_config(a.config)
    run(cfg, Path(a.out) if a.out else cfg.paths.models / "run", a.limit, a.device)


if __name__ == "__main__":
    main()
