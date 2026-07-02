# ============================================================
# championsbuild backend - Cloud Run image
# ============================================================
# Multi-stage optional; a single stage is enough here since gunicorn
# + uvicorn workers do not require build tooling at runtime.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System deps needed by some Python wheels (cryptography, grpcio) on slim.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (better layer caching).
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy application source.
COPY . ./

# Cloud Run injects PORT (default 8080). Bind gunicorn to it.
ENV PORT=8080
EXPOSE 8080

# Healthcheck: /api/health is defined in server.py.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

# gunicorn with uvicorn workers is the recommended prod combo for FastAPI.
# Cloud Run scales instances horizontally, so we keep workers modest.
CMD ["sh", "-c", "exec gunicorn -k uvicorn.workers.UvicornWorker -w ${WEB_CONCURRENCY:-2} -b 0.0.0.0:${PORT} --timeout 120 --access-logfile - --error-logfile - server:app"]
