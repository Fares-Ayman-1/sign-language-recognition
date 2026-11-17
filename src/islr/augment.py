"""Training-time augmentation on selected points [T, P, 2] (NaN = missing). NumPy only.

Each sign is shown by only 21 people in the data, so the model must not learn one person's size,
framing or speed. Every augmentation changes something a new signer or camera would also change.
"""

from __future__ import annotations

import numpy as np

from islr.landmarks import LIPS_S, POSE_S


def affine(x: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Random scale, aspect, rotation, shear and shift around the sequence centre."""
    pts = x.reshape(-1, 2)
    pts = pts[~np.isnan(pts[:, 0])]
    if len(pts) == 0:
        return x
    centre = pts.mean(axis=0)
    s = rng.uniform(0.8, 1.2)
    a = rng.uniform(0.9, 1.1)
    th = np.deg2rad(rng.uniform(-15, 15))
    sh = rng.uniform(-0.15, 0.15)
    rot = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
    m = rot @ np.array([[1.0, sh], [0.0, 1.0]]) @ np.diag([s * a, s / a])
    shift = rng.uniform(-0.05, 0.05, size=2)
    return ((x - centre) @ m.T + centre + shift).astype(np.float32)


def resample(x: np.ndarray, rng: np.random.Generator, low: float = 0.7, high: float = 1.3) -> np.ndarray:
    """Play the sign faster or slower by picking frames at a random speed (nearest frame)."""
    t = len(x)
    n = max(2, round(t * rng.uniform(low, high)))
    idx = np.clip(np.floor(np.arange(n) * t / n).astype(int), 0, t - 1)
    return x[idx]


def drop_frames(x: np.ndarray, rng: np.random.Generator, p: float = 0.1) -> np.ndarray:
    if len(x) < 8:
        return x
    keep = rng.random(len(x)) >= p
    return x[keep] if keep.sum() >= 4 else x


def drop_part(x: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Hide the lips or the pose for a random span of frames (a hand or an arm out of shot)."""
    x = x.copy()
    part = LIPS_S if rng.random() < 0.5 else POSE_S
    t = len(x)
    span = max(1, int(t * rng.uniform(0.1, 0.4)))
    start = int(rng.integers(0, max(1, t - span + 1)))
    x[start : start + span, part] = np.nan
    return x


def augment(x: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    if rng.random() < 0.8:
        x = affine(x, rng)
    if rng.random() < 0.5:
        x = resample(x, rng)
    if rng.random() < 0.3:
        x = drop_frames(x, rng)
    if rng.random() < 0.3:
        x = drop_part(x, rng)
    return x
