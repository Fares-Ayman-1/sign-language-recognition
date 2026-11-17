"""Landmark layout of the Isolated Sign Language Recognition data and a reader for its parquet files.

Every frame holds 543 MediaPipe Holistic landmarks in a fixed order: face (468), left hand (21),
pose (33), right hand (21). A part that was not detected in a frame is NaN. This module needs only
NumPy and PyArrow, so the serving image can use it without PyTorch.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pyarrow.parquet as pq

N_LANDMARKS = 543
TYPE_OFFSET = {"face": 0, "left_hand": 468, "pose": 489, "right_hand": 522}

# Lip contour on the face mesh, listed so that each half mirrors the other around the centre points
# 0, 17, 13 and 14 (checked on real data in tests/test_landmarks.py and the README).
LIPS = [
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,  # outer upper, left to right
    146, 91, 181, 84, 17, 314, 405, 321, 375,  # outer lower
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308,  # inner upper
    95, 88, 178, 87, 14, 317, 402, 318, 324,  # inner lower
]  # fmt: skip
LIP_MIRROR = {
    61: 291, 185: 409, 40: 270, 39: 269, 37: 267, 0: 0,
    146: 375, 91: 321, 181: 405, 84: 314, 17: 17,
    78: 308, 191: 415, 80: 310, 81: 311, 82: 312, 13: 13,
    95: 324, 88: 318, 178: 402, 87: 317, 14: 14,
}  # fmt: skip
LIP_MIRROR |= {v: k for k, v in LIP_MIRROR.items()}
NOSE = 1
POSE_UPPER = [11, 12, 13, 14, 15, 16]  # shoulders, elbows, wrists (left, right pairs)

# Selected points, in this order: nose, lips, left hand, right hand, upper-body pose.
SELECTED: list[int] = (
    [NOSE]
    + LIPS
    + [TYPE_OFFSET["left_hand"] + i for i in range(21)]
    + [TYPE_OFFSET["right_hand"] + i for i in range(21)]
    + [TYPE_OFFSET["pose"] + i for i in POSE_UPPER]
)
P = len(SELECTED)
NOSE_S = slice(0, 1)
LIPS_S = slice(1, 1 + len(LIPS))
LEFT_S = slice(LIPS_S.stop, LIPS_S.stop + 21)
RIGHT_S = slice(LEFT_S.stop, LEFT_S.stop + 21)
POSE_S = slice(RIGHT_S.stop, RIGHT_S.stop + len(POSE_UPPER))


def mirror_permutation() -> list[int]:
    """Index map for a left-right mirror: mirrored[i] = points[perm[i]] (x must also become 1 - x)."""
    perm = [0]
    perm += [1 + LIPS.index(LIP_MIRROR[p]) for p in LIPS]
    perm += list(range(RIGHT_S.start, RIGHT_S.stop))  # the left-hand slot takes the right hand
    perm += list(range(LEFT_S.start, LEFT_S.stop))
    pairs = {11: 12, 12: 11, 13: 14, 14: 13, 15: 16, 16: 15}
    perm += [POSE_S.start + POSE_UPPER.index(pairs[p]) for p in POSE_UPPER]
    return perm


MIRROR = mirror_permutation()


def read_parquet(path: str | Path | Any) -> np.ndarray:
    """Read one competition landmark file into a float32 array of shape [frames, 543, 3] (NaN = missing)."""
    t = pq.read_table(path, columns=["frame", "type", "landmark_index", "x", "y", "z"])
    frame = t.column("frame").to_numpy()
    kinds = t.column("type").to_pylist()
    lm = t.column("landmark_index").to_numpy()
    try:
        offset = np.fromiter((TYPE_OFFSET[k] for k in kinds), dtype=np.int64, count=len(kinds))
    except KeyError as e:
        raise ValueError(f"unknown landmark type {e.args[0]!r}") from None
    idx = offset + lm
    if idx.size and (idx.min() < 0 or idx.max() >= N_LANDMARKS):
        raise ValueError("landmark_index out of range")
    frames, inverse = np.unique(frame, return_inverse=True)
    out = np.full((len(frames), N_LANDMARKS, 3), np.nan, dtype=np.float32)
    for j, c in enumerate("xyz"):
        out[inverse, idx, j] = t.column(c).to_numpy(zero_copy_only=False).astype(np.float32)
    return out


def select(raw: np.ndarray) -> np.ndarray:
    """[T, 543, 3] -> [T, P, 2]: the selected points, x and y only (z from MediaPipe is too noisy)."""
    return raw[:, SELECTED, :2]
