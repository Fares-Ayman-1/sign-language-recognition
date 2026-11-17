"""Drift checks: compare new landmark sequences with the training data, and flag a retrain.

Three checks, each with a threshold from the model card:
- **sequence length** (population stability index over length bins): different camera frame rates or
  signing speed;
- **missing landmarks** (dominant hand, lips, pose missing per frame): framing, lighting, occlusion;
- **model confidence** (mean top-1 probability vs the held-out signers): the model is less sure on the
  new data than it was on signers it had never seen.

Input checks (length, missing landmarks) only raise a warning to investigate: the four held-out signers
already shift the length distribution (PSI 0.20) while the model keeps its accuracy. A confidence drop is
what recommends retraining. The report also gives the PSI noise floor, about (bins - 1)(1/n + 1/n_ref),
the value expected from sampling alone when nothing has changed.

    uv run python -m islr.monitoring        # local cache vs reports/reference.json -> reports/monitoring.*
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from islr.landmarks import LEFT_S, LIPS_S, POSE_S, RIGHT_S

LENGTH_BINS = [0, 8, 16, 24, 32, 48, 64, 96, 128, 10**9]
THRESHOLDS = {"length_psi": 0.2, "missing_rate_change": 0.15, "confidence_drop": 0.10}


def _missing(part: np.ndarray) -> np.ndarray:
    """Per frame: True when no point of the part [T, k, 2] is present."""
    return np.isnan(part[..., 0]).all(axis=1)


def profile(points: np.ndarray, index: pd.DataFrame, confidence: np.ndarray | None = None) -> dict[str, Any]:
    """Summary of a set of sequences: length histogram, missing-landmark rates, mean confidence."""
    lengths = index.length.to_numpy()
    hand, lips, pose = [], [], []
    for s, n in zip(index.start.to_numpy(), lengths, strict=True):
        x = np.asarray(points[s : s + n], dtype=np.float32)
        left, right = _missing(x[:, LEFT_S]), _missing(x[:, RIGHT_S])
        hand.append(min(left.mean(), right.mean()))  # the dominant hand is the one seen more often
        lips.append(_missing(x[:, LIPS_S]).mean())
        pose.append(_missing(x[:, POSE_S]).mean())
    counts, _ = np.histogram(lengths, bins=LENGTH_BINS)
    out: dict[str, Any] = {
        "sequences": len(index),
        "length_bins": LENGTH_BINS,
        "length_share": (counts / max(1, counts.sum())).round(5).tolist(),
        "length_median": float(np.median(lengths)) if len(lengths) else 0.0,
        "missing": {
            "dominant_hand": float(np.mean(hand)),
            "lips": float(np.mean(lips)),
            "pose": float(np.mean(pose)),
        },
    }
    if confidence is not None:
        out["mean_confidence"] = float(np.mean(confidence))
    return out


def psi(ref: list[float], cur: list[float], eps: float = 1e-4) -> float:
    r, c = np.clip(np.asarray(ref), eps, None), np.clip(np.asarray(cur), eps, None)
    return float(np.sum((c - r) * np.log(c / r)))


def compare(reference: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    checks: list[dict[str, Any]] = []
    v = psi(reference["length_share"], current["length_share"])
    checks.append({"check": "length_psi", "value": v, "threshold": THRESHOLDS["length_psi"]})
    for part, ref in reference["missing"].items():
        d = abs(current["missing"][part] - ref)
        checks.append(
            {"check": f"missing_{part}", "value": d, "threshold": THRESHOLDS["missing_rate_change"]}
        )
    if "mean_confidence" in reference and "mean_confidence" in current:
        d = reference["mean_confidence"] - current["mean_confidence"]
        checks.append({"check": "confidence_drop", "value": d, "threshold": THRESHOLDS["confidence_drop"]})
    for c in checks:
        c["value"] = round(c["value"], 4)
        c["passed"] = c["value"] <= c["threshold"]
        c["kind"] = "performance" if c["check"] == "confidence_drop" else "input"
    bins = len(reference["length_share"])
    noise = (bins - 1) * (1 / max(1, current["sequences"]) + 1 / max(1, reference["sequences"]))
    return {
        "checks": checks,
        "input_drift": not all(c["passed"] for c in checks if c["kind"] == "input"),
        "retrain_recommended": not all(c["passed"] for c in checks if c["kind"] == "performance"),
        "length_psi_noise_floor": round(noise, 4),
        "reference_sequences": reference["sequences"],
        "current_sequences": current["sequences"],
    }


def to_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Monitoring report",
        "",
        f"Reference: {report['reference_sequences']} training sequences. "
        f"Current: {report['current_sequences']} sequences. Length PSI expected from sampling alone: "
        f"about {report['length_psi_noise_floor']:.3f}.",
        "",
        "| Check | Kind | Value | Threshold | Result |",
        "|---|---|---:|---:|---|",
    ]
    for c in report["checks"]:
        result = "pass" if c["passed"] else ("warn" if c["kind"] == "input" else "FAIL")
        lines.append(f"| {c['check']} | {c['kind']} | {c['value']:.4f} | {c['threshold']} | {result} |")
    if report["retrain_recommended"]:
        verdict = "**Retrain recommended:** the model is less confident on the new data."
    elif report["input_drift"]:
        verdict = (
            "**Input drift, no retrain yet:** the inputs changed but confidence held. Check a labelled "
            "sample from the new setting before retraining."
        )
    else:
        verdict = "**No drift found.**"
    return "\n".join([*lines, "", verdict, ""])


def onnx_confidence(model_path: Path, raw_files: list[Path]) -> np.ndarray:
    import onnxruntime as ort

    from islr.landmarks import read_parquet

    sess = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    return np.array([float(sess.run(None, {"landmarks": read_parquet(f)})[0].max()) for f in raw_files])


def main() -> None:
    from islr.config import load_config
    from islr.data import load_cache

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", default=None)
    cfg = load_config(ap.parse_args().config)
    reference = json.loads((cfg.paths.reports / "reference.json").read_text(encoding="utf-8"))
    points, index = load_cache(cfg.paths.cache)
    raw = pd.read_csv(cfg.paths.raw / "train.csv").set_index("sequence_id").path
    files = [cfg.paths.raw / raw[s] for s in index.sequence_id]
    conf = onnx_confidence(cfg.paths.models / "model.onnx", files)
    report = compare(reference, profile(points, index, conf))
    cfg.paths.reports.mkdir(parents=True, exist_ok=True)
    (cfg.paths.reports / "monitoring.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (cfg.paths.reports / "monitoring.md").write_text(to_markdown(report), encoding="utf-8")
    print(to_markdown(report))


if __name__ == "__main__":
    main()
