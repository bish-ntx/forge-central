# Forge Central

Forge Central is a control-plane service that wraps local `./forge` CLI workflows behind a FastAPI backend.

## Architecture Overview

- `api/app/main.py`: FastAPI application bootstrap.
- `api/app/config.py`: Environment-based runtime settings.
- `api/app/services/process_runner.py`: Async `./forge` subprocess runner.
- `api/app/routers/cli.py`: Base API routes (`/health`, `/api/v1/version`, `/api/v1/cli/execute`).
- `api/app/schemas/cli.py`: Pydantic request/response models.
- `api/tests/test_cli_runner.py`: Async endpoint tests using `httpx.AsyncClient`.

## Quickstart

```bash
cd ~/work/git/forge-central
python3 -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt
uvicorn api.app.main:app --reload --port 8000
```

OpenAPI docs are available at:

- `http://127.0.0.1:8000/docs`

## Environment Variables

- `FORGE_BIN`: Absolute or relative path to the forge executable. Default is `./forge` from the current working directory.
