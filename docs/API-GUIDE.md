# Forge Central API Guide

## Base Routes

### `GET /health`

Returns service liveness with forge binary path metadata.

Example response:

```json
{
  "status": "healthy",
  "forge_bin": "/path/to/forge"
}
```

### `GET /api/v1/version`

Returns backend control-plane version and local `./forge --version` result.

Example response:

```json
{
  "control_plane_version": "1.0.0",
  "forge_bin": "/path/to/forge",
  "forge_version": "forge v0.1.0"
}
```

### `POST /api/v1/cli/execute`

Starts an asynchronous CLI run using the local forge executable.

Request body:

```json
{
  "command": "provision vms",
  "args": ["--conf", "config/amd-lab-template.ini", "--dry-run"],
  "env_overrides": {
    "FORGE_ENV": "test"
  }
}
```

Response (`202 Accepted`):

```json
{
  "run_id": "8ac9feba-9584-4fd6-8483-6f6f8f2a8f8c",
  "status": "PENDING",
  "command": "/path/to/forge provision vms --conf config/amd-lab-template.ini --dry-run",
  "started_at": "2026-09-26T21:40:00Z"
}
```
