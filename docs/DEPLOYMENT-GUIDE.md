# Forge Central Deployment Guide

Forge Central is packaged as one self-contained container: the React UI is compiled in a Node 20 stage and served by FastAPI (`StaticFiles`) from `/app/ui/dist`. API routers are registered first, so `/api/*`, `/health` and `/docs` always win over the static fallback.

## Image

- Stage 1: `node:20-alpine` runs `npm ci && npm run build` for `ui/`.
- Stage 2: `python:3.11-slim` installs `api/requirements.txt`, `curl` and `openssh-client` (`ssh`/`scp` for `./forge`) and `gosu`, then copies `api/` and the built `dist`.
- The app runs as non-root user `forgecentral` (UID 1000) via `gosu` after `docker-entrypoint.sh` stages SSH keys; exposes port `8000`.
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
| `/nkp-forge` (read-only) | `nkp-forge` CLI checkout; `FORGE_BIN` defaults to `/nkp-forge/forge` | `~/nkp-forge` |
| `/staging/ssh-key` (read-only) | Operator SSH keys, staged by the entrypoint into the container's own `~/.ssh` (see below) | `~/.ssh` (override with `SSH_KEY_DIR`) |

Without the `nkp-forge` and SSH key mounts, `/vms`, `/ipam` and `/clusters` return HTTP 500 in non-mock mode because the CLI engine and SSH credentials are missing. Override the CLI location with `FORGE_BIN=/nkp-forge/forge` (Compose default).

### In-container SSH key staging

No host `chmod`/`chown` of `~/.ssh` is needed. Compose mounts the host key directory read-only at `/staging/ssh-key` (set `SSH_KEY_DIR=~/ssh-key` to use a different directory). On start, `docker-entrypoint.sh` (the image `ENTRYPOINT`, which begins as root only for this step):

1. copies the staged keys into `/home/forgecentral/.ssh/` (symlinks are dereferenced; unreadable entries are skipped with a warning);
2. runs `chown -R forgecentral:forgecentral` (UID 1000), `chmod 700` on the directory and `chmod 600` on every file;
3. drops privileges with `gosu forgecentral` and execs the app (`uvicorn`).

The host files stay untouched and read-only; the container owns its private copy, refreshed on every restart (`docker compose restart forge-central` after rotating keys). With no `/staging/ssh-key` mount (or an empty one) the step is skipped. `docker run` equivalent: `-v ~/.ssh:/staging/ssh-key:ro`.

Host directories must be writable by container UID 1000 (`sudo chown -R 1000:1001 ~/forge-state ~/forge-data ~/cacrt && sudo chmod -R 2775 ~/forge-state ~/forge-data ~/cacrt`). This allows the container's `forgecentral` process (UID 1000) and the host's `nkpadmin` user (GID 1001) full read/write access.

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

`docker-compose.yml` passes through `FORGE_MOCK_MODE`, `FORGE_HOME` and `PORT` (host port), uses `restart: unless-stopped` and reserves 0.5 CPU / 256M memory. `SSH_KEY_DIR` (default `~/.ssh`) selects the host key directory staged at `/staging/ssh-key`.

Try it offline: `FORGE_MOCK_MODE=true docker compose up -d --build`, then open `http://localhost:8000`.

## Standalone Release Packaging & Air-Gapped Upgrade

For lab environments without internet access, build a self-contained tarball on a connected host:

```bash
scripts/build-release-bundle.sh                       # version from api/app/config.py
scripts/build-release-bundle.sh --version 1.1.0 --output-dir ./release
scripts/build-release-bundle.sh --dry-run             # print actions only
```

Output: `forge-central-v<VERSION>.tar.gz` plus `forge-central-v<VERSION>.tar.gz.sha256` (default directory `dist-release/`). The archive contains `api/app`, `api/requirements.txt`, the compiled `ui/dist` (built with `npm --prefix ui run build` if missing), `docs/`, `README.md`, `Dockerfile`, `docker-compose.yml` and `scripts/`.

Upgrade workflow:

1. Copy the `.tar.gz` and its `.sha256` file to the air-gapped host (same directory).
2. Open the Web Console at `/settings/upgrade`, enter the bundle path and press **Inspect Bundle** (or call `POST /api/v1/upgrade/inspect`). Pre-flight checks: bundle format, SHA-256 against the companion file, bundle version >= current version (parsed from the filename), and more than 1 GB free disk space.
3. When all checks pass, apply the upgrade with `./scripts/install-upgrade.sh --bundle <path>`.

`GET /api/v1/upgrade/status` returns the running version, architecture and platform.

## Notes

- The `./forge` CLI engine is not bundled; Compose mounts `~/nkp-forge` at `/nkp-forge` (read-only) and sets `FORGE_BIN` to `/nkp-forge/forge` for real (non-mock) runs.
- If `ui/dist` is absent (e.g. API-only dev) no static mount is registered and the API behaves as before.
