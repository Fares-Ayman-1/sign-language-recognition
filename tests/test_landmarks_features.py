from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
import torch

from islr.augment import affine, augment, drop_part, resample
from islr.features import FEATURE_DIM, Preprocess
from islr.landmarks import LIP_MIRROR, LIPS, LIPS_S, MIRROR, SELECTED, P, read_parquet, select
from islr.model import SignModel
from tests.synthetic import make_sequence, write_parquet


def test_read_parquet_places_every_landmark(tmp_path: Path) -> None:
    raw = make_sequence(3, 9, np.random.default_rng(0))
    write_parquet(raw, tmp_path / "a.parquet", shuffle=True)  # row order must not matter
    got = read_parquet(tmp_path / "a.parquet")
    assert got.shape == (9, 543, 3)
    np.testing.assert_allclose(np.nan_to_num(got), np.nan_to_num(raw), atol=1e-6)
    assert np.isnan(got[:, 468:489]).all()  # right-handed signer: left hand missing


def test_read_parquet_rejects_unknown_parts(tmp_path: Path) -> None:
    import pandas as pd

    df = pd.DataFrame(
        {"frame": [0], "type": ["tail"], "landmark_index": [0], "x": [0.1], "y": [0.2], "z": [0.0]}
    )
    df.to_parquet(tmp_path / "bad.parquet")
    with pytest.raises(ValueError, match="unknown landmark type"):
        read_parquet(tmp_path / "bad.parquet")


def test_selection_and_mirror_map() -> None:
    assert P == len(SELECTED) == 89
    assert sorted(MIRROR) == list(range(P))
    assert [MIRROR[MIRROR[i]] for i in range(P)] == list(range(P))  # mirroring twice is the identity
    for i, p in enumerate(LIPS):
        assert LIPS[MIRROR[LIPS_S.start + i] - LIPS_S.start] == LIP_MIRROR[p]
    assert select(np.zeros((4, 543, 3), np.float32)).shape == (4, P, 2)


def _mirror_raw(raw: np.ndarray) -> np.ndarray:
    """What a mirrored camera would record: x -> 1 - x, left and right hands swapped, face mirrored."""
    m = raw.copy()
    m[..., 0] = 1.0 - m[..., 0]
    m[:, 468:489], m[:, 522:543] = raw[:, 522:543].copy(), raw[:, 468:489].copy()
    m[:, 468:489, 0] = 1.0 - m[:, 468:489, 0]
    m[:, 522:543, 0] = 1.0 - m[:, 522:543, 0]
    for a, b in LIP_MIRROR.items():
        m[:, a] = raw[:, b]
        m[:, a, 0] = 1.0 - raw[:, b, 0]
    for a, b in [(11, 12), (13, 14), (15, 16)]:
        m[:, 489 + a], m[:, 489 + b] = raw[:, 489 + b].copy(), raw[:, 489 + a].copy()
        m[:, [489 + a, 489 + b], 0] = 1.0 - m[:, [489 + a, 489 + b], 0]
    return m


def test_features_are_the_same_for_left_and_right_handed_signers() -> None:
    raw = make_sequence(1, 20, np.random.default_rng(1))
    pre = Preprocess(64)
    a = pre(torch.from_numpy(raw))
    b = pre(torch.from_numpy(_mirror_raw(raw)))
    assert a.shape == (20, FEATURE_DIM)
    assert not torch.isnan(a).any()
    torch.testing.assert_close(a, b, atol=1e-4, rtol=1e-4)


def test_features_ignore_position_and_scale_of_the_signer() -> None:
    raw = make_sequence(2, 15, np.random.default_rng(2))
    moved = raw.copy()
    moved[..., :2] = (raw[..., :2] - 0.5) * 0.7 + 0.45  # smaller and further away, shifted
    pre = Preprocess(64)
    torch.testing.assert_close(pre(torch.from_numpy(raw)), pre(torch.from_numpy(moved)), atol=1e-4, rtol=1e-3)


@pytest.mark.parametrize(("frames", "expected"), [(1, 1), (30, 30), (64, 64), (65, 64), (400, 64)])
def test_long_sequences_keep_max_len_frames(frames: int, expected: int) -> None:
    raw = make_sequence(0, frames, np.random.default_rng(3))
    assert Preprocess(64)(torch.from_numpy(raw)).shape == (expected, FEATURE_DIM)


def test_missing_everything_gives_zeros_not_nan() -> None:
    raw = np.full((5, 543, 3), np.nan, np.float32)
    out = Preprocess(64)(torch.from_numpy(raw))
    assert torch.equal(out, torch.zeros_like(out))


def test_padded_batch_with_mask_equals_single_sequences() -> None:
    """Training uses padded batches + mask; serving runs one unpadded sequence. They must agree."""
    torch.manual_seed(0)
    model = SignModel(n_classes=10, dim=32, stages=1, convs_per_stage=2, kernel=5, heads=2).eval()
    pre = Preprocess(64)
    seqs = [
        pre(torch.from_numpy(make_sequence(i, n, np.random.default_rng(i)))) for i, n in enumerate([5, 12, 9])
    ]
    x = torch.zeros(3, 12, FEATURE_DIM)
    mask = torch.zeros(3, 12, dtype=torch.bool)
    for i, s in enumerate(seqs):
        x[i, : len(s)] = s
        mask[i, : len(s)] = True
    with torch.no_grad():
        batched = model(x, mask)
        single = torch.cat([model(s.unsqueeze(0)) for s in seqs])
    torch.testing.assert_close(batched, single, atol=1e-5, rtol=1e-4)


def test_augmentations_keep_shape_and_missing_points() -> None:
    rng = np.random.default_rng(0)
    x = select(make_sequence(4, 30, rng))
    a = affine(x, rng)
    assert a.shape == x.shape
    assert np.array_equal(np.isnan(a), np.isnan(x))
    r = resample(x, rng, 2.0, 2.0)
    assert len(r) == 60
    d = drop_part(x, rng)
    assert np.isnan(d).sum() > np.isnan(x).sum()
    for _ in range(20):
        out = augment(x, rng)
        assert out.ndim == 3 and out.shape[1:] == (P, 2) and len(out) >= 4
    empty = np.full((5, P, 2), np.nan, np.float32)
    assert np.isnan(affine(empty, rng)).all()
