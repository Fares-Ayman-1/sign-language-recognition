"""Sign prediction API (ONNX Runtime, no PyTorch at serving time) and the webcam demo.

POST the MediaPipe Holistic landmarks of one sign, either as a competition-format parquet file or as
JSON frames, and get the most likely signs. The model graph does all preprocessing, so the API only
arranges the landmarks into the [frames, 543, 3] array the model expects.

    MODEL_DIR=models uv run uvicorn islr.serve.api:app --port 8030      # demo at /demo/
"""

from __future__ import annotations

import io
import json
import os
import time
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

import numpy as np
from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError, field_validator
from starlette.exceptions import HTTPException as StarletteHTTPException

from islr import __version__
from islr.landmarks import N_LANDMARKS, SELECTED, TYPE_OFFSET, read_parquet

ROOT = Path(__file__).resolve().parents[3]
WEB = ROOT / "app" / "web"
MAX_BYTES = 10 * 1024 * 1024
MAX_FRAMES = 1000
PART_SIZE = {"face": 468, "left_hand": 21, "pose": 33, "right_hand": 21}


class Recognizer:
    def __init__(self, model_dir: Path):
        import onnxruntime as ort

        self.path = model_dir / "model.onnx"
        if not self.path.exists():
            raise FileNotFoundError(f"no model in {model_dir}; run `python -m islr.export` first")
        self.session = ort.InferenceSession(str(self.path), providers=["CPUExecutionProvider"])
        self.meta: dict[str, Any] = json.loads((model_dir / "meta.json").read_text(encoding="utf-8"))
        self.signs: list[str] = self.meta["signs"]

    def predict(self, raw: np.ndarray, top_k: int) -> list[tuple[str, float]]:
        probs = self.session.run(None, {"landmarks": raw.astype(np.float32)})[0]
        top = np.argsort(-probs)[:top_k]
        return [(self.signs[i], float(probs[i])) for i in top]


@lru_cache(maxsize=1)
def get_model() -> Recognizer:
    return Recognizer(Path(os.environ.get("MODEL_DIR", ROOT / "models")))


# ------------------------------------------------------------------------------------- schemas
class ErrorBody(BaseModel):
    code: str = Field(examples=["invalid_landmarks"])
    message: str
    details: list[dict[str, Any]] | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


Point = Annotated[list[float], Field(min_length=2, max_length=3)]


class Frame(BaseModel):
    """One video frame. A part that MediaPipe did not detect is null or omitted."""

    face: list[Point] | None = Field(default=None, description="468 points")
    left_hand: list[Point] | None = Field(default=None, description="21 points")
    pose: list[Point] | None = Field(default=None, description="33 points")
    right_hand: list[Point] | None = Field(default=None, description="21 points")

    @field_validator("face", "left_hand", "pose", "right_hand")
    @classmethod
    def _size(cls, v: list[Point] | None, info: Any) -> list[Point] | None:
        if v is not None and len(v) != PART_SIZE[info.field_name]:
            raise ValueError(f"{info.field_name} needs {PART_SIZE[info.field_name]} points, got {len(v)}")
        return v


class LandmarkRequest(BaseModel):
    frames: list[Frame] = Field(min_length=1, max_length=MAX_FRAMES)


class SignScore(BaseModel):
    sign: str = Field(examples=["hello"])
    probability: float


class PredictionResponse(BaseModel):
    predictions: list[SignScore]
    frames: int = Field(description="Frames received")
    frames_used: int = Field(description="Frames the model looked at (at most 64, evenly spaced)")
    dominant_hand: str = Field(description="`right`, `left` or `none`: the hand seen in more frames")
    hands_detected_frames: int
    latency_ms: float


class ModelInfo(BaseModel):
    api_version: str
    model: str
    signs: int
    max_frames_used: int
    size_mb: float
    parameters: int
    validation: dict[str, Any] = Field(description="Accuracy on signers never seen in training")
    mlflow_run_ids: dict[str, str]


class SignList(BaseModel):
    items: list[str]
    total: int


# ------------------------------------------------------------------------------------- app + errors
app = FastAPI(
    title="Sign Language Recognition API",
    version=__version__,
    description="Recognises 250 isolated ASL signs from MediaPipe Holistic landmarks. "
    'Errors always use `{"error": {"code", "message", "details"}}`. A live webcam demo is at `/demo/`.',
)


def _err(status: int, code: str, message: str, details: list[dict[str, Any]] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status, content={"error": {"code": code, "message": message, "details": details}}
    )


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, details: list[dict[str, Any]] | None = None):
        self.status, self.code, self.message, self.details = status, code, message, details


@app.exception_handler(ApiError)
async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
    return _err(exc.status, exc.code, exc.message, exc.details)


@app.exception_handler(RequestValidationError)
async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = [{"field": ".".join(str(p) for p in e["loc"]), "issue": e["msg"]} for e in exc.errors()]
    return _err(422, "validation_error", "The request is invalid.", details)


@app.exception_handler(StarletteHTTPException)
async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    codes = {404: "not_found", 405: "method_not_allowed"}
    return _err(exc.status_code, codes.get(exc.status_code, "http_error"), str(exc.detail))


@app.exception_handler(Exception)
async def _unhandled(_: Request, exc: Exception) -> JSONResponse:  # pragma: no cover - safety net
    return _err(500, "internal_error", "Something went wrong on our side.")


# ------------------------------------------------------------------------------------- parsing
def frames_to_array(frames: list[Frame]) -> np.ndarray:
    raw = np.full((len(frames), N_LANDMARKS, 3), np.nan, dtype=np.float32)
    for t, f in enumerate(frames):
        for part, off in TYPE_OFFSET.items():
            pts = getattr(f, part)
            if pts is None:
                continue
            arr = np.array([p + [0.0] * (3 - len(p)) for p in pts], dtype=np.float32)
            raw[t, off : off + len(arr)] = arr
    return raw


async def read_landmarks(request: Request) -> np.ndarray:
    ctype = request.headers.get("content-type", "")
    body = await request.body()
    if len(body) > MAX_BYTES:
        raise ApiError(
            413, "payload_too_large", f"The request is larger than {MAX_BYTES // 1024 // 1024} MB."
        )
    if ctype.startswith("application/json"):
        try:
            req = LandmarkRequest.model_validate_json(body)
        except ValidationError as e:
            details = [{"field": ".".join(str(p) for p in d["loc"]), "issue": d["msg"]} for d in e.errors()]
            raise ApiError(422, "validation_error", "The landmark JSON is invalid.", details[:20]) from None
        return frames_to_array(req.frames)
    if ctype.startswith("multipart/form-data"):
        form = await request.form()
        upload = form.get("landmarks")
        if upload is None or isinstance(upload, str):
            raise ApiError(422, "validation_error", "Send the parquet file in the form field `landmarks`.")
        try:
            raw = read_parquet(io.BytesIO(await upload.read()))
        except Exception as e:
            raise ApiError(
                422, "invalid_landmarks", "The file is not a competition-format landmark parquet file."
            ) from e
        if len(raw) == 0:
            raise ApiError(422, "invalid_landmarks", "The file has no frames.")
        if len(raw) > MAX_FRAMES:
            raise ApiError(422, "too_many_frames", f"At most {MAX_FRAMES} frames per sign.")
        return raw
    raise ApiError(415, "unsupported_media_type", "Use application/json or multipart/form-data.")


# ------------------------------------------------------------------------------------- routes
@app.get("/health", tags=["meta"], summary="Liveness check")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/model", tags=["meta"], summary="Model details and validation scores", response_model=ModelInfo)
def model_info() -> ModelInfo:
    m = get_model().meta
    return ModelInfo(
        api_version=__version__,
        model="Conv1D + Transformer, preprocessing inside the ONNX graph, ONNX Runtime",
        signs=len(m["signs"]),
        max_frames_used=m["max_len"],
        size_mb=m["size_mb"],
        parameters=m["parameters"],
        validation={
            "top1": m["valid_top1"],
            "top5": m["valid_top5"],
            "sequences": m["valid_sequences"],
            "held_out": "4 of 21 signers, never seen in training",
        },
        mlflow_run_ids=m.get("mlflow_run_ids", {}),
    )


@app.get("/v1/signs", tags=["meta"], summary="The 250 signs the model knows", response_model=SignList)
def signs() -> SignList:
    s = get_model().signs
    return SignList(items=s, total=len(s))


_BODY_DOC: dict[str, Any] = {
    "requestBody": {
        "required": True,
        "content": {
            "application/json": {
                "schema": LandmarkRequest.model_json_schema(ref_template="#/components/schemas/{model}")
            },
            "multipart/form-data": {
                "schema": {
                    "type": "object",
                    "required": ["landmarks"],
                    "properties": {
                        "landmarks": {
                            "type": "string",
                            "format": "binary",
                            "description": "Competition-format parquet: frame, type, landmark_index, x, y, z",
                        }
                    },
                }
            },
        },
    }
}


@app.post(
    "/v1/predictions",
    tags=["prediction"],
    summary="Recognise one sign from its landmarks",
    response_model=PredictionResponse,
    responses={
        413: {"model": ErrorResponse, "description": "`payload_too_large`"},
        415: {"model": ErrorResponse, "description": "`unsupported_media_type`"},
        422: {
            "model": ErrorResponse,
            "description": "`validation_error`, `invalid_landmarks`, `too_many_frames`, `no_landmarks`",
        },
    },
    openapi_extra=_BODY_DOC,
)
async def predict(
    request: Request, top_k: Annotated[int, Query(ge=1, le=20, description="How many signs to return")] = 5
) -> PredictionResponse:
    raw = await read_landmarks(request)
    sel = raw[:, SELECTED, 0]
    if np.isnan(sel).all():
        raise ApiError(422, "no_landmarks", "No usable landmarks (face, hands or pose) in any frame.")
    lh = (~np.isnan(raw[:, 468:489, 0])).any(axis=1)
    rh = (~np.isnan(raw[:, 522:543, 0])).any(axis=1)
    left, right = int(lh.sum()), int(rh.sum())
    t0 = time.perf_counter()
    top = get_model().predict(raw, top_k)
    ms = (time.perf_counter() - t0) * 1000
    return PredictionResponse(
        predictions=[SignScore(sign=s, probability=round(p, 5)) for s, p in top],
        frames=len(raw),
        frames_used=min(len(raw), int(get_model().meta["max_len"])),
        dominant_hand="none" if left == right == 0 else ("left" if left > right else "right"),
        hands_detected_frames=int((lh | rh).sum()),
        latency_ms=round(ms, 2),
    )


# ------------------------------------------------------------------------------------- webcam demo
@app.get("/demo", include_in_schema=False)
def demo_redirect() -> RedirectResponse:
    return RedirectResponse("/demo/")


@app.get("/demo/model.onnx", include_in_schema=False)
def demo_model() -> FileResponse:
    return FileResponse(get_model().path, media_type="application/octet-stream")


@app.get("/demo/meta.json", include_in_schema=False)
def demo_meta() -> JSONResponse:
    m = get_model().meta
    return JSONResponse({k: m[k] for k in ("signs", "max_len", "valid_top1", "valid_top5")})


if WEB.is_dir():
    app.mount("/demo", StaticFiles(directory=WEB, html=True), name="demo")
