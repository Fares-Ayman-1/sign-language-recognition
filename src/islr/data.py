"""Raw landmark parquet files -> one compact cache: the selected points of every sequence.

The full competition data is 56 GB of parquet (543 landmarks x 3 coordinates per frame). The model
uses 89 points and x, y only, so the cache is about 40 times smaller and fits in memory:

- ``points.npy``: float16 [total_frames, P, 2], all sequences one after another (NaN = missing);
- ``index.csv``: one row per sequence with its label, signer, start row and number of frames.

    uv run python -m islr.data            # every sequence whose file is present under data/raw
"""

from __future__ import annotations

import argparse
import json
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

from islr.config import load_config
from islr.landmarks import P, read_parquet, select


def sign_map(raw: Path) -> dict[str, int]:
    return json.loads((raw / "sign_to_prediction_index_map.json").read_text(encoding="utf-8"))


def _load(path: str) -> np.ndarray:
    return select(read_parquet(path)).astype(np.float16)


def prepare(raw: Path, out: Path, workers: int = 1, limit: int | None = None) -> pd.DataFrame:
    df = pd.read_csv(raw / "train.csv")
    df = df[[(raw / p).exists() for p in df.path]].reset_index(drop=True)
    if limit:
        df = df.head(limit)
    if df.empty:
        raise FileNotFoundError(f"no landmark files under {raw}")
    paths = [str(raw / p) for p in df.path]
    t0 = time.perf_counter()
    if workers > 1:
        with ProcessPoolExecutor(workers) as ex:
            arrays = list(ex.map(_load, paths, chunksize=64))
    else:
        arrays = [_load(p) for p in paths]
    lengths = np.array([len(a) for a in arrays])
    df["label"] = df.sign.map(sign_map(raw)).astype(int)
    df["length"] = lengths
    df["start"] = np.concatenate([[0], np.cumsum(lengths)[:-1]])
    out.mkdir(parents=True, exist_ok=True)
    pts = np.concatenate(arrays) if arrays else np.zeros((0, P, 2), np.float16)
    np.save(out / "points.npy", pts)
    df.drop(columns=["path"]).to_csv(out / "index.csv", index=False)
    print(
        f"cached {len(df)} sequences, {len(pts)} frames ({pts.nbytes / 1e6:.0f} MB) "
        f"in {time.perf_counter() - t0:.0f} s",
        flush=True,
    )
    return df


def load_cache(cache: Path, mmap: bool = False) -> tuple[np.ndarray, pd.DataFrame]:
    pts = np.load(cache / "points.npy", mmap_mode="r" if mmap else None)
    return pts, pd.read_csv(cache / "index.csv")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", default=None)
    ap.add_argument("--workers", type=int, default=1)
    ap.add_argument("--limit", type=int, default=None)
    a = ap.parse_args()
    cfg = load_config(a.config)
    prepare(cfg.paths.raw, cfg.paths.cache, a.workers, a.limit)


if __name__ == "__main__":
    main()
