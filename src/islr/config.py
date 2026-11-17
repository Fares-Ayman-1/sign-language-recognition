"""Typed configuration loaded from YAML, plus the shared MLflow setup."""

from __future__ import annotations

import os
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Paths(BaseModel):
    raw: Path
    cache: Path
    models: Path
    reports: Path

    def resolve(self, root: Path) -> Paths:
        return Paths(
            **{k: (v if v.is_absolute() else (root / v).resolve()) for k, v in self.model_dump().items()}
        )


class ModelConfig(BaseModel):
    dim: int = Field(gt=0)
    stages: int = Field(gt=0)
    convs_per_stage: int = Field(ge=0)
    kernel: int = Field(gt=0)
    heads: int = Field(gt=0)
    expand: int = Field(gt=0)
    drop: float = Field(ge=0, lt=1)
    head_drop: float = Field(ge=0, lt=1)


class TrainConfig(BaseModel):
    epochs: int = Field(gt=0)
    batch_size: int = Field(gt=0)
    lr: float = Field(gt=0)
    weight_decay: float = Field(ge=0)
    warmup_epochs: int = Field(ge=0)
    label_smoothing: float = Field(ge=0, lt=1)
    num_workers: int = Field(ge=0)
    amp: bool = True
    seed: int = 42


class BaselineConfig(BaseModel):
    epochs: int = Field(gt=0)
    hidden: int = Field(gt=0)
    lr: float = Field(gt=0)


class Config(BaseModel):
    paths: Paths
    tracking_uri: str
    artifact_root: str
    experiment: str
    valid_participants: list[int]
    max_len: int = Field(gt=0)
    model: ModelConfig
    train: TrainConfig
    baseline: BaselineConfig


def load_config(path: str | Path | None = None, root: Path = PROJECT_ROOT) -> Config:
    p = Path(path) if path else root / "configs" / "default.yaml"
    cfg = Config.model_validate(yaml.safe_load(p.read_text(encoding="utf-8")))
    cfg.paths = cfg.paths.resolve(root)
    return cfg


def _abs(p: str, root: Path) -> Path:
    path = Path(p)
    return path if path.is_absolute() else (root / path).resolve()


def setup_mlflow(cfg: Config, root: Path = PROJECT_ROOT) -> str:
    import mlflow

    uri = os.environ.get("MLFLOW_TRACKING_URI") or "sqlite:///" + _abs(cfg.tracking_uri, root).as_posix()
    mlflow.set_tracking_uri(uri)
    exp = mlflow.get_experiment_by_name(cfg.experiment)
    if exp is not None:
        mlflow.set_experiment(experiment_id=exp.experiment_id)
        return str(exp.experiment_id)
    art = _abs(cfg.artifact_root, root)
    art.mkdir(parents=True, exist_ok=True)
    exp_id = mlflow.create_experiment(cfg.experiment, artifact_location=art.as_uri())
    mlflow.set_experiment(experiment_id=exp_id)
    return str(exp_id)
