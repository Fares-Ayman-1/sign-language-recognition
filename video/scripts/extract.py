"""Export real held-out landmark clips + the shipped model's predictions as JSON for the Remotion video.

Run from the project root:  uv run python video/scripts/extract.py
Writes video/public/clips.json. Coordinates are rounded to 3 decimals; NaN (not detected) -> null.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort

from islr.landmarks import TYPE_OFFSET, read_parquet

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "video" / "public" / "clips.json"

meta = json.loads((ROOT / "models" / "meta.json").read_text(encoding="utf-8"))
signs: list[str] = meta["signs"]
sess = ort.InferenceSession(str(ROOT / "models" / "model.onnx"), providers=["CPUExecutionProvider"])

rows = []
with open(RAW / "train.csv", newline="") as f:
    for r in csv.DictReader(f):
        p = RAW / r["path"]
        if p.exists():
            rows.append((p, r["sign"], r["participant_id"]))


def predict(raw: np.ndarray) -> np.ndarray:
    return sess.run(None, {"landmarks": raw.astype(np.float32)})[0]


def pack(raw: np.ndarray) -> list:
    """[frames][543] of [x, y] or null; face kept (drawn faint), z dropped."""
    frames = []
    for fr in raw:
        pts = []
        for x, y in fr[:, :2]:
            pts.append(None if np.isnan(x) else [round(float(x), 3), round(float(y), 3)])
        frames.append(pts)
    return frames


def handedness(raw: np.ndarray) -> str:
    lh = (~np.isnan(raw[:, TYPE_OFFSET["left_hand"], 0])).sum()
    rh = (~np.isnan(raw[:, TYPE_OFFSET["right_hand"], 0])).sum()
    return "left" if lh > rh else "right"


scored = []
for p, sign, pid in rows:
    raw = read_parquet(p)
    probs = predict(raw)
    scored.append((p, sign, pid, raw, probs))
print(f"{len(scored)} local held-out files scored")


def top5(probs: np.ndarray) -> list:
    idx = np.argsort(-probs)[:5]
    return [{"sign": signs[i], "p": round(float(probs[i]), 4)} for i in idx]


def best_correct(sign: str):
    """The local file of `sign` the model is most confident (and right) about."""
    c = [s for s in scored if s[1] == sign]
    c.sort(key=lambda s: -s[4][signs.index(sign)])
    return c[0] if c else None


def clip(entry, why: str) -> dict:
    p, sign, pid, raw, probs = entry
    return {
        "why": why,
        "file": f"{pid}/{p.name}",
        "participant": int(pid),
        "label": sign,
        "frames": len(raw),
        "handedness": handedness(raw),
        "top5": top5(probs),
        "landmarks": pack(raw),
    }


out: dict = {"source": "Google ISLR (Kaggle asl-signs), CC BY 4.0; held-out signers only", "clips": {}}

water = best_correct("water")
if water:
    out["clips"]["water"] = clip(water, "hero")

# Showcase demo clips: confident, correct, visually lively, varied.
correct = [s for s in scored if signs[int(np.argmax(s[4]))] == s[1] and s[3].shape[0] >= 20]
correct.sort(key=lambda s: -float(np.max(s[4])))
used = {"water"}
demo = []
for s in correct:
    if s[1] in used:
        continue
    used.add(s[1])
    demo.append(s)
    if len(demo) == 6:
        break
for i, s in enumerate(demo):
    out["clips"][f"demo{i}"] = clip(s, "demo")

# A left-hand-dominant signer for the mirroring scene.
lefts = [s for s in scored if handedness(s[3]) == "left"]
lefts.sort(key=lambda s: -float(np.max(s[4])))
if lefts:
    out["clips"]["lefty"] = clip(lefts[0], "mirror")

# Confusion pairs: prefer a real miss (true A predicted as B); otherwise any example of each.
for a, b in [("awake", "wake"), ("cat", "kitty"), ("mouth", "lips"), ("pencil", "pen"), ("quiet", "shhh")]:
    miss = [s for s in scored if s[1] == a and signs[int(np.argmax(s[4]))] == b]
    ea = miss[0] if miss else best_correct(a)
    eb = best_correct(b)
    if ea and eb:
        out["clips"][f"pair_{a}"] = clip(ea, f"confusion:{a}")
        out["clips"][f"pair_{b}"] = clip(eb, f"confusion:{b}")
        print(f"pair {a}/{b}: real miss={bool(miss)}")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
for k, v in out["clips"].items():
    print(
        f"{k:12s} {v['label']:10s} pid={v['participant']} frames={v['frames']:3d} "
        f"{v['handedness']:5s} top1={v['top5'][0]}"
    )
print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)")
