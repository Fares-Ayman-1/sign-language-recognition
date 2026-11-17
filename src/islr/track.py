"""Record a finished training run (from Kaggle or from this machine) in MLflow.

Reads ``metrics.json`` and ``baseline.json`` from the run folder, logs a baseline run and a model run
(parameters, the per-epoch history, final scores, artifacts), writes their ids to ``mlflow.json`` and
a summary with the ids to ``reports/metrics.json``. ``python -m islr.report`` builds RESULTS.md from
those MLflow runs.

    uv run python -m islr.track --run models/run --source "kaggle:<owner>/<kernel> v1"
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import mlflow

from islr.config import PROJECT_ROOT, Config, load_config, setup_mlflow


def _params(d: dict[str, Any]) -> dict[str, str]:
    return {k: json.dumps(v) if isinstance(v, list | dict) else str(v) for k, v in d.items()}


def track(cfg: Config, run_dir: Path, source: str, root: Path = PROJECT_ROOT) -> dict[str, str]:
    setup_mlflow(cfg, root)
    res = json.loads((run_dir / "metrics.json").read_text(encoding="utf-8"))
    base = json.loads((run_dir / "baseline.json").read_text(encoding="utf-8"))
    tags = {"source": source, "device": res["device"], "split": "signer-independent"}

    with mlflow.start_run(run_name="baselines") as rb:
        mlflow.set_tags(tags)
        mlflow.log_params(_params({**base["params"], "valid_participants": cfg.valid_participants}))
        mlflow.log_metrics(
            {
                "majority_top1": base["majority_top1"],
                "bag_of_frames_top1": base["bag_of_frames_top1"],
                "bag_of_frames_top5": base["bag_of_frames_top5"],
            }
        )
    with mlflow.start_run(run_name="conv1d-transformer") as rm:
        mlflow.set_tags(tags)
        mlflow.log_params(_params(res["params"]))
        for h in res["history"]:
            mlflow.log_metric("train_loss", h["train_loss"], step=h["epoch"])
            if "val_top1" in h:
                mlflow.log_metric("val_top1_epoch", h["val_top1"], step=h["epoch"])
                mlflow.log_metric("val_top5_epoch", h["val_top5"], step=h["epoch"])
        m = res["metrics"]
        mlflow.log_metrics({"valid_top1": m["top1"], "valid_top5": m["top5"], "minutes": res["minutes"]})
        for f in ("metrics.json", "val_predictions.npz"):
            if (run_dir / f).exists():
                mlflow.log_artifact(str(run_dir / f))

    ids = {"model": rm.info.run_id, "baseline": rb.info.run_id}
    (run_dir / "mlflow.json").write_text(json.dumps(ids, indent=2), encoding="utf-8")
    summary = {
        "mlflow_run_ids": ids,
        "source": source,
        "device": res["device"],
        "minutes": res["minutes"],
        "params": res["params"],
        "metrics": res["metrics"],
        "baseline": {k: v for k, v in base.items() if k != "params"},
        "history": res["history"],
    }
    cfg.paths.reports.mkdir(parents=True, exist_ok=True)
    (cfg.paths.reports / "metrics.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"tracked: model run {ids['model']}, baseline run {ids['baseline']}")
    return ids


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", default=None)
    ap.add_argument("--run", default=None)
    ap.add_argument("--source", default="local")
    a = ap.parse_args()
    cfg = load_config(a.config)
    track(cfg, Path(a.run) if a.run else cfg.paths.models / "run", a.source)


if __name__ == "__main__":
    main()
