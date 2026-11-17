"""Score the exported ONNX model on the landmark files downloaded to this machine.

The Kaggle run scores every held-out video in PyTorch. This checks the shipped artifact instead: the
raw parquet files go through the same reader the API uses and into ONNX Runtime, with no PyTorch.
The local files are a sample of the same held-out signers, so the accuracy should be close.

    uv run python -m islr.evaluate        # -> reports/onnx_check.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from islr.config import Config, load_config
from islr.landmarks import read_parquet


def evaluate(cfg: Config, model_dir: Path) -> dict[str, Any]:
    import onnxruntime as ort

    meta = json.loads((model_dir / "meta.json").read_text(encoding="utf-8"))
    index = {s: i for i, s in enumerate(meta["signs"])}
    df = pd.read_csv(cfg.paths.raw / "train.csv")
    df = df[df.participant_id.isin(cfg.valid_participants)]
    df = df[[(cfg.paths.raw / p).exists() for p in df.path]]
    if df.empty:
        raise FileNotFoundError("no held-out landmark files found; run scripts/download_data.py")
    sess = ort.InferenceSession(str(model_dir / "model.onnx"), providers=["CPUExecutionProvider"])
    probs = np.stack([sess.run(None, {"landmarks": read_parquet(cfg.paths.raw / p)})[0] for p in df.path])
    y = df.sign.map(index).to_numpy()
    top5 = np.argsort(-probs, axis=1)[:, :5]
    result = {
        "sequences": len(df),
        "signers": sorted(int(p) for p in df.participant_id.unique()),
        "signs": int(df.sign.nunique()),
        "top1": float((top5[:, 0] == y).mean()),
        "top5": float((top5 == y[:, None]).any(axis=1).mean()),
        "mean_confidence": float(probs.max(axis=1).mean()),
        "kaggle_run_top1_all_held_out": meta["valid_top1"],
    }
    cfg.paths.reports.mkdir(parents=True, exist_ok=True)
    (cfg.paths.reports / "onnx_check.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    return result


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", default=None)
    cfg = load_config(ap.parse_args().config)
    evaluate(cfg, cfg.paths.models)


if __name__ == "__main__":
    main()
