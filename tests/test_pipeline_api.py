from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from islr.config import Config
from islr.data import load_cache
from islr.landmarks import P
from islr.monitoring import compare, profile, psi, to_markdown
from islr.report import build
from tests.synthetic import make_sequence, write_parquet


def test_cache_holds_every_sequence(trained: Config) -> None:
    points, index = load_cache(trained.paths.cache)
    assert len(index) == 4 * 6 * 3
    assert points.shape == (index.length.sum(), P, 2)
    assert points.dtype == np.float16
    assert (index.start.diff().dropna() == index.length.iloc[:-1].to_numpy()).all()


def test_training_writes_run_files_and_holds_out_signers(trained: Config) -> None:
    run = trained.paths.models / "run"
    for f in ("weights.pt", "metrics.json", "baseline.json", "val_predictions.npz", "mlflow.json"):
        assert (run / f).exists(), f
    res = json.loads((run / "metrics.json").read_text(encoding="utf-8"))
    assert res["params"]["valid_sequences"] == 18  # signer 104 only
    assert res["params"]["train_sequences"] == 54
    assert 0.0 <= res["metrics"]["top1"] <= res["metrics"]["top5"] <= 1.0
    pred = np.load(run / "val_predictions.npz")
    assert pred["top5"].shape == (18, 5)


def test_onnx_export_matches_pytorch(trained: Config) -> None:
    meta = json.loads((trained.paths.models / "meta.json").read_text(encoding="utf-8"))
    assert meta["onnx_parity_max_abs_diff"] < 1e-4
    assert len(meta["signs"]) == 250
    assert set(meta["mlflow_run_ids"]) == {"model", "baseline"}


def test_results_report_comes_from_mlflow(trained: Config) -> None:
    text = build(trained, root=trained.paths.raw.parents[1])
    ids = json.loads((trained.paths.reports / "metrics.json").read_text(encoding="utf-8"))["mlflow_run_ids"]
    assert ids["model"] in text and ids["baseline"] in text
    assert "Conv1D + Transformer" in text and "Bag of frames" in text


def test_monitoring_flags_a_shift_and_passes_the_same_data(trained: Config) -> None:
    points, index = load_cache(trained.paths.cache)
    ref = profile(points, index, np.full(len(index), 0.6))
    same = compare(ref, profile(points, index, np.full(len(index), 0.6)))
    assert not same["retrain_recommended"] and not same["input_drift"]
    assert "No drift found" in to_markdown(same)
    shifted = index.copy()
    shifted["length"] = (shifted.length // 3).clip(lower=1)
    inputs_only = compare(ref, profile(points, shifted, np.full(len(index), 0.6)))
    assert inputs_only["input_drift"] and not inputs_only["retrain_recommended"]
    assert "Input drift, no retrain yet" in to_markdown(inputs_only)
    drift = compare(ref, profile(points, shifted, np.full(len(index), 0.3)))
    assert drift["retrain_recommended"]
    assert "Retrain recommended" in to_markdown(drift)
    assert drift["length_psi_noise_floor"] > 0
    assert psi([0.5, 0.5], [0.5, 0.5]) == 0.0


# ------------------------------------------------------------------------------------- API
def _frames_json(raw: np.ndarray) -> dict:
    parts = {"face": (0, 468), "left_hand": (468, 489), "pose": (489, 522), "right_hand": (522, 543)}
    frames = []
    for f in raw:
        fr = {}
        for name, (a, b) in parts.items():
            if not np.isnan(f[a:b, 0]).all():
                fr[name] = f[a:b].tolist()
        frames.append(fr)
    return {"frames": frames}


def test_health_model_and_signs(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}
    info = client.get("/v1/model").json()
    assert info["signs"] == 250 and info["max_frames_used"] == 16
    assert set(info["mlflow_run_ids"]) == {"model", "baseline"}
    signs = client.get("/v1/signs").json()
    assert signs["total"] == 250 and signs["items"][0] == "sign000"


def test_parquet_and_json_give_the_same_prediction(client: TestClient, tmp_path: Path) -> None:
    raw = make_sequence(2, 25, np.random.default_rng(5), left_handed=True)
    write_parquet(raw, tmp_path / "s.parquet")
    a = client.post(
        "/v1/predictions?top_k=3", files={"landmarks": ("s.parquet", (tmp_path / "s.parquet").read_bytes())}
    )
    b = client.post("/v1/predictions?top_k=3", json=_frames_json(raw))
    assert a.status_code == b.status_code == 200
    ja, jb = a.json(), b.json()
    assert [p["sign"] for p in ja["predictions"]] == [p["sign"] for p in jb["predictions"]]
    assert len(ja["predictions"]) == 3
    assert ja["frames"] == 25 and ja["frames_used"] == 16
    assert ja["dominant_hand"] == "left" and ja["hands_detected_frames"] == 25


def test_errors_use_one_shape(client: TestClient) -> None:
    cases = [
        (
            client.post("/v1/predictions", content=b"x", headers={"content-type": "text/plain"}),
            415,
            "unsupported_media_type",
        ),
        (
            client.post("/v1/predictions", files={"landmarks": ("x.parquet", b"not parquet")}),
            422,
            "invalid_landmarks",
        ),
        (client.post("/v1/predictions", files={"other": ("x.parquet", b"x")}), 422, "validation_error"),
        (client.post("/v1/predictions", json={"frames": []}), 422, "validation_error"),
        (
            client.post("/v1/predictions", json={"frames": [{"right_hand": [[0.1, 0.2]] * 5}]}),
            422,
            "validation_error",
        ),
        (client.post("/v1/predictions", json={"frames": [{}, {}]}), 422, "no_landmarks"),
        (client.post("/v1/predictions?top_k=0", json={"frames": [{}]}), 422, "validation_error"),
        (client.get("/v1/nothing"), 404, "not_found"),
    ]
    for resp, status, code in cases:
        assert resp.status_code == status, (code, resp.json())
        assert resp.json()["error"]["code"] == code


def test_demo_page_and_model_are_served(client: TestClient) -> None:
    page = client.get("/demo/")
    assert page.status_code == 200 and "Sign recognition" in page.text
    assert client.get("/demo/demo.js").status_code == 200
    assert client.get("/demo/model.onnx").content[:4] != b""
    meta = client.get("/demo/meta.json").json()
    assert len(meta["signs"]) == 250 and "valid_top1" in meta


def test_sample_csv_layout_matches_the_competition(project: Config) -> None:
    df = pd.read_csv(project.paths.raw / "train.csv")
    assert list(df.columns) == ["path", "participant_id", "sequence_id", "sign"]


def test_onnx_check_scores_the_held_out_files(trained: Config) -> None:
    from islr.evaluate import evaluate

    res = evaluate(trained, trained.paths.models)
    assert res["sequences"] == 18 and res["signers"] == [104]
    assert 0.0 <= res["top1"] <= res["top5"] <= 1.0
    assert (trained.paths.reports / "onnx_check.json").exists()
