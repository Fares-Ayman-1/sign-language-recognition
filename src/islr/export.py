"""Export preprocessing + model to one ONNX graph and check it against PyTorch.

Input ``landmarks``: float32 [frames, 543, 3], raw MediaPipe Holistic output (NaN = not detected).
Output ``probabilities``: float32 [250]. The same file runs in the API (ONNX Runtime) and in the
browser demo (ONNX Runtime Web).

    uv run python -m islr.export --run models/run
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import torch

from islr.config import Config, load_config
from islr.data import sign_map
from islr.model import EndToEnd
from islr.train import build_model

OPSET = 17


def synthetic_raw(frames: int, seed: int = 0, left_handed: bool = False) -> np.ndarray:
    """A plausible raw landmark array: random points with one hand missing, for export checks and tests."""
    rng = np.random.default_rng(seed)
    raw = rng.uniform(0.2, 0.8, size=(frames, 543, 3)).astype(np.float32)
    missing = slice(522, 543) if left_handed else slice(468, 489)
    raw[:, missing] = np.nan
    raw[rng.random(frames) < 0.2, 0:468] = np.nan  # face lost in some frames
    return raw


def export(model: EndToEnd, path: Path) -> None:
    model.eval()
    path.parent.mkdir(parents=True, exist_ok=True)
    example = torch.from_numpy(synthetic_raw(20))
    torch.onnx.export(
        model,
        (example,),
        str(path),
        input_names=["landmarks"],
        output_names=["probabilities"],
        dynamic_axes={"landmarks": {0: "frames"}},
        opset_version=OPSET,
        dynamo=False,
    )


def parity(model: EndToEnd, path: Path, lengths: tuple[int, ...] = (1, 7, 64, 65, 300)) -> float:
    """Largest absolute difference between PyTorch and ONNX Runtime probabilities."""
    import onnxruntime as ort

    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    worst = 0.0
    for i, n in enumerate(lengths):
        raw = synthetic_raw(n, seed=i, left_handed=i % 2 == 1)
        with torch.no_grad():
            ref = model(torch.from_numpy(raw)).numpy()
        got = sess.run(None, {"landmarks": raw})[0]
        worst = max(worst, float(np.abs(ref - got).max()))
    return worst


def run(cfg: Config, run_dir: Path, out_dir: Path) -> dict[str, Any]:
    signs = [s for s, _ in sorted(sign_map(cfg.paths.raw).items(), key=lambda kv: kv[1])]
    net = build_model(cfg, len(signs))
    net.load_state_dict(torch.load(run_dir / "weights.pt", map_location="cpu", weights_only=True))
    model = EndToEnd(net, cfg.max_len).eval()
    onnx_path = out_dir / "model.onnx"
    export(model, onnx_path)
    diff = parity(model, onnx_path)
    if diff > 1e-4:
        raise RuntimeError(f"ONNX output differs from PyTorch by {diff:.2e}")
    metrics = json.loads((run_dir / "metrics.json").read_text(encoding="utf-8"))
    meta = {
        "signs": signs,
        "max_len": cfg.max_len,
        "opset": OPSET,
        "onnx_parity_max_abs_diff": diff,
        "size_mb": round(onnx_path.stat().st_size / 1e6, 2),
        "parameters": metrics["params"]["parameters"],
        "valid_top1": metrics["metrics"]["top1"],
        "valid_top5": metrics["metrics"]["top5"],
        "valid_sequences": metrics["metrics"]["n"],
    }
    tracked = run_dir / "mlflow.json"
    if tracked.exists():
        meta["mlflow_run_ids"] = json.loads(tracked.read_text(encoding="utf-8"))
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"exported {onnx_path} ({meta['size_mb']} MB), max |torch - onnx| = {diff:.1e}")
    return meta


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", default=None)
    ap.add_argument("--run", default=None)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    cfg = load_config(a.config)
    run_dir = Path(a.run) if a.run else cfg.paths.models / "run"
    run(cfg, run_dir, Path(a.out) if a.out else cfg.paths.models)


if __name__ == "__main__":
    main()
