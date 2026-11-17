# API + webcam demo image: ONNX Runtime only, no PyTorch. The model is mounted at runtime.
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home app \
    && mkdir /app && chown app /app

COPY --from=ghcr.io/astral-sh/uv:0.9.7 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

USER app
WORKDIR /app
COPY --chown=app pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project
COPY --chown=app src ./src
COPY --chown=app app ./app
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH" \
    MODEL_DIR=/app/models \
    PYTHONUNBUFFERED=1

EXPOSE 8030
HEALTHCHECK --interval=30s --timeout=3s CMD curl -fsS http://localhost:8030/health || exit 1
CMD ["uvicorn", "islr.serve.api:app", "--host", "0.0.0.0", "--port", "8030"]
