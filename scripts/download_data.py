"""Download the Isolated Sign Language Recognition data with the Kaggle API.

The full data is 56 GB (94,477 parquet files). By default this downloads only the index files and a
sample of N sequences from the held-out signers (enough for the API, the drift report and the ONNX
check); ``--all`` downloads everything. Training on all of it is easiest in the Kaggle notebook, where
the data is already mounted.

Requires KAGGLE_API_TOKEN (or ~/.kaggle/kaggle.json) and the competition rules accepted on kaggle.com.

    uv run python scripts/download_data.py --sample 300
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import time
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

COMPETITION = "asl-signs"
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
VALID = [4718, 26734, 37779, 61333]


def _unzip_all(folder: Path) -> None:
    for z in folder.rglob("*.zip"):
        with zipfile.ZipFile(z) as zf:
            zf.extractall(z.parent)
        z.unlink()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--sample", type=int, default=300)
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    try:
        import truststore

        truststore.inject_into_ssl()
    except ImportError:
        pass
    from kaggle.api.kaggle_api_extended import KaggleApi

    api = KaggleApi()
    api.authenticate()
    RAW.mkdir(parents=True, exist_ok=True)
    if a.all:
        api.competition_download_files(COMPETITION, path=str(RAW), quiet=False)
        _unzip_all(RAW)
    else:
        for f in ("train.csv", "sign_to_prediction_index_map.json"):
            if not (RAW / f).exists():
                api.competition_download_file(COMPETITION, f, path=str(RAW), quiet=True)
        _unzip_all(RAW)
        df = pd.read_csv(RAW / "train.csv")
        held_out = df[df.participant_id.isin(VALID)].sample(frac=1.0, random_state=0)
        # one video of every sign, then a second video for the first (N - 250) signs
        first, second = held_out.groupby("sign").head(1), held_out.groupby("sign").nth(1)
        sample = pd.concat([first, second.head(max(0, a.sample - len(first)))]).head(a.sample)
        failed = []
        for i, p in enumerate(sample.path):
            target = RAW / p
            if target.exists():
                continue
            # Long sequences are the biggest files and the likeliest to time out; skipping them would
            # bias the sample towards short signs (and fake a length drift), so retry and report.
            for attempt in range(3):
                try:
                    api.competition_download_file(COMPETITION, p, path=str(RAW / "_tmp"), quiet=True)
                    break
                except Exception as e:
                    print(f"retry {attempt + 1} {p}: {e}", flush=True)
                    time.sleep(3)
            _unzip_all(RAW / "_tmp")
            got = next((RAW / "_tmp").rglob(Path(p).name), None)
            if got is None:
                failed.append(p)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(got), target)
            if i % 50 == 0:
                print(f"{i}/{len(sample)}", flush=True)
        shutil.rmtree(RAW / "_tmp", ignore_errors=True)
        if failed:
            raise SystemExit(f"{len(failed)} files failed; run the script again to fetch them: {failed[:5]}")
    files = list((RAW / "train_landmark_files").rglob("*.parquet"))
    (RAW.parent / "MANIFEST.json").write_text(
        json.dumps(
            {
                "competition": COMPETITION,
                "checked_at": datetime.now(UTC).isoformat(timespec="seconds"),
                "train_csv_sha256": hashlib.sha256((RAW / "train.csv").read_bytes()).hexdigest(),
                "landmark_files": len(files),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"ok: {len(files)} landmark files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
