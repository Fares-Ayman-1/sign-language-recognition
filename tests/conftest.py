"""One synthetic project per test session: data -> cache -> training -> MLflow -> ONNX, all on CPU."""

from __future__ import annotations

import os

import pytest
import yaml

from islr.config import Config, load_config
from tests.synthetic import make_dataset

os.environ.setdefault("MLFLOW_DISABLE_AGENT_HINT", "1")
PARTICIPANTS = [101, 102, 103, 104]


@pytest.fixture(scope="session")
def project(tmp_path_factory: pytest.TempPathFactory) -> Config:
    root = tmp_path_factory.mktemp("project")
    make_dataset(root / "data" / "raw", PARTICIPANTS)
    cfg = {
        "paths": {"raw": "data/raw", "cache": "data/cache", "models": "models", "reports": "reports"},
        "tracking_uri": (root / "mlflow.db").as_posix(),
        "artifact_root": (root / "mlruns").as_posix(),
        "experiment": "test",
        "valid_participants": [104],
        "max_len": 16,
        "model": {"dim": 32, "stages": 1, "convs_per_stage": 1, "kernel": 5, "heads": 2, "expand": 2,
                  "drop": 0.1, "head_drop": 0.1},
        "train": {"epochs": 2, "batch_size": 8, "lr": 0.003, "weight_decay": 0.01, "warmup_epochs": 1,
                  "label_smoothing": 0.1, "num_workers": 0, "amp": False, "seed": 0},
        "baseline": {"epochs": 3, "hidden": 32, "lr": 0.003},
    }  # fmt: skip
    (root / "config.yaml").write_text(yaml.safe_dump(cfg), encoding="utf-8")
    return load_config(root / "config.yaml", root=root)


@pytest.fixture(scope="session")
def trained(project: Config) -> Config:
    """The full pipeline on the synthetic data; returns the config with a model in models/."""
    from islr.baseline import run as run_baseline
    from islr.data import prepare
    from islr.export import run as run_export
    from islr.track import track
    from islr.train import train

    root = project.paths.raw.parents[1]
    prepare(project.paths.raw, project.paths.cache)
    run_dir = project.paths.models / "run"
    train(project, run_dir, device_name="cpu")
    run_baseline(project, run_dir, device_name="cpu")
    track(project, run_dir, "test", root=root)
    run_export(project, run_dir, project.paths.models)
    return project


@pytest.fixture(scope="session")
def client(trained: Config):  # type: ignore[no-untyped-def]
    from fastapi.testclient import TestClient

    os.environ["MODEL_DIR"] = str(trained.paths.models)
    from islr.serve import api

    api.get_model.cache_clear()
    return TestClient(api.app)
