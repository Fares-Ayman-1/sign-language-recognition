"""Synthetic landmark data in the competition's exact file format (the real data is never committed).

Each sign is a distinct circular motion of the dominant hand, so a tiny model can learn something in a
few steps. Some signers are left-handed: their motion is mirrored into the left-hand slot.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

SIGNS = [f"sign{i:03d}" for i in range(250)]
PARTS = [("face", 468), ("left_hand", 21), ("pose", 33), ("right_hand", 21)]


def make_sequence(sign: int, frames: int, rng: np.random.Generator, left_handed: bool = False) -> np.ndarray:
    """Raw landmarks [frames, 543, 3] (NaN = missing) for one synthetic sign."""
    raw = np.full((frames, 543, 3), np.nan, dtype=np.float32)
    t = np.linspace(0, 2 * np.pi, frames)
    face = rng.normal(0, 0.02, size=(468, 3)) + np.array([0.5, 0.3, 0.0])
    raw[:, 0:468] = face + rng.normal(0, 0.002, size=(frames, 468, 3))
    pose = rng.normal(0, 0.05, size=(33, 3)) + np.array([0.5, 0.6, 0.0])
    raw[:, 489:522] = pose
    radius = 0.05 + 0.01 * (sign % 5)
    cx = 0.35 + 0.02 * (sign % 7)
    hand_x = cx + radius * np.cos(t * (1 + sign % 3))
    hand_y = 0.5 + radius * np.sin(t * (1 + sign % 3))
    shape = rng.normal(0, 0.02, size=(21, 3))
    hand = np.stack([hand_x, hand_y, np.zeros(frames)], axis=1)[:, None, :] + shape
    if left_handed:
        hand[..., 0] = 1.0 - hand[..., 0]
        raw[:, 468:489] = hand
    else:
        raw[:, 522:543] = hand
    return raw + rng.normal(0, 0.003, size=raw.shape).astype(np.float32)


def write_parquet(raw: np.ndarray, path: Path, shuffle: bool = False, seed: int = 0) -> None:
    """Write raw landmarks in the competition layout: one row per frame and landmark."""
    rows = []
    for f in range(len(raw)):
        off = 0
        for kind, n in PARTS:
            for i in range(n):
                x, y, z = raw[f, off + i]
                rows.append((f + 20, f"{f + 20}-{kind}-{i}", kind, i, x, y, z))
            off += n
    df = pd.DataFrame(rows, columns=["frame", "row_id", "type", "landmark_index", "x", "y", "z"])
    if shuffle:
        df = df.sample(frac=1.0, random_state=seed)
    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(pa.Table.from_pandas(df, preserve_index=False), path)


def make_dataset(
    raw_dir: Path, participants: list[int], signs: int = 6, per_sign: int = 3, seed: int = 0
) -> None:
    rng = np.random.default_rng(seed)
    records = []
    seq = 1000
    for pid in participants:
        left = pid % 2 == 1
        for s in range(signs):
            for _ in range(per_sign):
                frames = int(rng.integers(6, 40))
                rel = f"train_landmark_files/{pid}/{seq}.parquet"
                write_parquet(make_sequence(s, frames, rng, left), raw_dir / rel)
                records.append({"path": rel, "participant_id": pid, "sequence_id": seq, "sign": SIGNS[s]})
                seq += 1
    pd.DataFrame(records).to_csv(raw_dir / "train.csv", index=False)
    (raw_dir / "sign_to_prediction_index_map.json").write_text(
        json.dumps({s: i for i, s in enumerate(SIGNS)}), encoding="utf-8"
    )
