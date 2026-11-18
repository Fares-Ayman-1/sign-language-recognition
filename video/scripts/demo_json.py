"""Write held-out recordings in the API/demo JSON format, for driving the real demo page.

Run from the project root:  uv run python video/scripts/demo_json.py
Reads the clip files chosen by extract.py (video/public/clips.json) and writes
video/capture/<name>.json with full x, y, z (null parts omitted), as the demo's file loader expects.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from islr.landmarks import TYPE_OFFSET, read_parquet

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "video" / "capture"
OUT.mkdir(exist_ok=True)
clips = json.loads((ROOT / "video" / "public" / "clips.json").read_text(encoding="utf-8"))["clips"]
SIZES = {"face": 468, "left_hand": 21, "pose": 33, "right_hand": 21}

for name in ["demo4", "demo2", "demo0"]:  # happy, look, radio (same as the video's demo scene)
    c = clips[name]
    raw = read_parquet(ROOT / "data" / "raw" / "train_landmark_files" / c["file"])
    frames = []
    for fr in raw:
        out: dict = {}
        for part, off in TYPE_OFFSET.items():
            pts = fr[off : off + SIZES[part]]
            if not np.isnan(pts[:, 0]).all():
                out[part] = [[round(float(v), 5) for v in p] for p in np.nan_to_num(pts, nan=0.0)]
        frames.append(out)
    (OUT / f"{c['label']}.json").write_text(json.dumps({"frames": frames}), encoding="utf-8")
    print(c["label"], len(frames), "frames")
