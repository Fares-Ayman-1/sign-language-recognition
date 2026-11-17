"""Write RESULTS.md from the MLflow runs recorded in reports/metrics.json (exact provenance).

uv run python -m islr.report
"""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

import mlflow

from islr.config import PROJECT_ROOT, Config, load_config, setup_mlflow


def build(cfg: Config, root: Path = PROJECT_ROOT) -> str:
    setup_mlflow(cfg, root)
    meta = json.loads((cfg.paths.reports / "metrics.json").read_text(encoding="utf-8"))
    ids = meta["mlflow_run_ids"]
    model, base = mlflow.get_run(ids["model"]), mlflow.get_run(ids["baseline"])
    m, b, p = model.data.metrics, base.data.metrics, model.data.params
    L = [
        "# Results",
        "",
        f"Generated from MLflow on {datetime.now(UTC):%Y-%m-%d %H:%M} UTC by `python -m islr.report`.",
        f"Validation: **{p.get('valid_sequences')} videos from 4 signers never seen in training** "
        f"(participants {p.get('valid_participants')}); {p.get('train_sequences')} videos from the other "
        "17 signers were used for training. Metric: accuracy over 250 signs (the competition metric is "
        "top-1 accuracy).",
        "",
        "| Model | Top-1 | Top-5 | MLflow run |",
        "|---|---:|---:|---|",
        f"| Conv1D + Transformer | **{m['valid_top1']:.4f}** | {m['valid_top5']:.4f} | `{ids['model']}` |",
        f"| Bag of frames (MLP on time-averaged features) | {b['bag_of_frames_top1']:.4f} | "
        f"{b['bag_of_frames_top5']:.4f} | `{ids['baseline']}` |",
        f"| Most frequent sign | {b['majority_top1']:.4f} | | `{ids['baseline']}` |",
        "",
        "## Hardest and easiest signs (top-1 on the held-out signers)",
        "",
    ]
    per = sorted(meta["metrics"]["per_sign"].items(), key=lambda kv: kv[1])
    L.append("Hardest: " + ", ".join(f"{s} {a:.2f}" for s, a in per[:10]) + ".")
    L.append("")
    L.append("Easiest: " + ", ".join(f"{s} {a:.2f}" for s, a in per[-5:]) + ".")
    L += [
        "",
        "## Most frequent confusions",
        "",
        "| True sign | Predicted | Times | Of |",
        "|---|---|---:|---:|",
    ]
    for c in meta["metrics"]["confusions"][:10]:
        L.append(f"| {c['true']} | {c['pred']} | {c['count']} | {c['of']} |")
    hist = [h for h in meta["history"] if "val_top1" in h]
    best = max(hist, key=lambda h: h["val_top1"])
    L += [
        "",
        "## Training (from the run's parameters and history)",
        "",
        f"- {p.get('stages')} stages of {p.get('convs_per_stage')} depthwise Conv1D blocks (kernel "
        f"{p.get('kernel')}) + 1 Transformer block ({p.get('heads')} heads), width {p.get('dim')}, "
        f"{int(p.get('parameters', 0)):,} parameters; at most {p.get('max_len')} frames",
        f"- {p.get('epochs')} epochs, batch {p.get('batch_size')}, AdamW (peak learning rate {p.get('lr')}, "
        f"weight decay {p.get('weight_decay')}), label smoothing {p.get('label_smoothing')}, "
        f"mixed precision {p.get('amp')}, on {model.data.tags.get('device')}",
        "- Final epoch scores are reported (no checkpoint picked on validation). The best validation "
        f"check was epoch {best['epoch']} at {best['val_top1']:.4f}; "
        f"total time {meta['minutes']:.0f} minutes",
        f"- Source: {model.data.tags.get('source')}",
    ]
    return "\n".join(L) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", default=None)
    cfg = load_config(ap.parse_args().config)
    (PROJECT_ROOT / "RESULTS.md").write_text(build(cfg), encoding="utf-8")
    print(f"wrote {PROJECT_ROOT / 'RESULTS.md'}")


if __name__ == "__main__":
    main()
