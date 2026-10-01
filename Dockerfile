# syntax=docker/dockerfile:1
# Forge Central — multi-stage production image

# Stage 1: build the React UI
FROM node:20-alpine AS frontend-builder
WORKDIR /build/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# Stage 2: FastAPI runtime serving API + compiled UI
FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FORGE_HOME=/forge-state \
    FORGE_CENTRAL_DATA_DIR=/forge-state \
    FORGE_DATA_DIR=/forge-data \
    FORGE_LOG_DIR=/var/log/forge-central
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt
COPY api/ api/
COPY --from=frontend-builder /build/ui/dist /app/ui/dist
RUN useradd --uid 1000 --create-home --shell /usr/sbin/nologin forgecentral \
    && mkdir -p /forge-state /forge-data /cacrt /var/log/forge-central \
    && chown -R forgecentral:forgecentral /app /forge-state /forge-data /cacrt /var/log/forge-central
USER forgecentral
VOLUME ["/forge-state", "/forge-data", "/cacrt", "/var/log/forge-central"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "api.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
