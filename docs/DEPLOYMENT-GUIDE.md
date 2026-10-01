# Forge Central Deployment Guide

Forge Central is packaged as one self-contained container: the React UI is compiled in a Node 20 stage and served by FastAPI (`StaticFiles`) from `/app/ui/dist`. API routers are registered first, so `/api/*`, `/health` and `/docs` always win over the static fallback.

## Image

- Stage 1: `node:20-alpine` runs `npm ci && npm run build` for `ui/`.
- Stage 2: `python:3.11-slim` installs `api/requirements.txt` and `curl`, then copies `api/` and the built `dist`.
- Runs as non-root user `forgecentral` (UID 1000), exposes port `8000`.
- Healthcheck: `curl -f http://localhost:8000/health || exit 1`.
- Command: `uvicorn api.app.main:app --host 0.0.0.0 --port 8000`.

```bash
docker build -t forge-central:latest .
```

## Volumes

| Mount point | Purpose | Host default (Compose) |
| --- | --- | --- |
| `/forge-state` | Forge Central state (`FORGE_HOME`, `FORGE_CENTRAL_DATA_DIR`) | `~/forge-state` |
| `/forge-data` | Lab INI/data (`FORGE_DATA_DIR`) | `~/forge-data` |
| `/cacrt` | CA certificates | `~/cacrt` |
| `/var/log/forge-central` | Logs (`FORGE_LOG_DIR`) | container volume |

Host directories must be writable by UID 1000 (`chown 1000 ~/forge-state ~/forge-data ~/cacrt`, or `mkdir` them first when using Docker Desktop).

## Docker Run

```bash
docker run -d --name forge-central -p 8000:8000 \
  -e FORGE_MOCK_MODE=false \
  -v ~/forge-state:/forge-state -v ~/forge-data:/forge-data -v ~/cacrt:/cacrt \
  forge-central:latest
```

## Docker Compose

```bash
docker compose up -d --build
docker compose ps        # health status
docker compose logs -f forge-central
docker compose down
```

`docker-compose.yml` passes through `FORGE_MOCK_MODE`, `FORGE_HOME` and `PORT` (host port), uses `restart: unless-stopped` and reserves 0.5 CPU / 256M memory.

Try it offline: `FORGE_MOCK_MODE=true docker compose up -d --build`, then open `http://localhost:8000`.

## Notes

- The `./forge` CLI engine is not bundled; set `FORGE_BIN` and mount it into the container for real (non-mock) runs.
- If `ui/dist` is absent (e.g. API-only dev) no static mount is registered and the API behaves as before.
