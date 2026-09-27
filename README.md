# Forge Central

Forge Central is a control-plane service that wraps local `./forge` CLI workflows behind a FastAPI backend.

It includes:

- `api/`: FastAPI REST control-plane services.
- `ui/`: React 18 + Vite web console with Tailwind dark theme routing shell.

## Architecture Overview

- `api/app/main.py`: FastAPI application bootstrap.
- `api/app/config.py`: Environment-based runtime settings.
- `api/app/services/process_runner.py`: Async `./forge` subprocess runner.
- `api/app/services/log_publisher.py`: In-memory SSE log event publisher.
- `api/app/routers/cli.py`: Base API routes (`/health`, `/api/v1/version`, `/api/v1/cli/execute`).
- `api/app/routers/pipeline.py`: Pipeline SSE stream route (`/api/v1/pipeline/{run_id}/stream`).
- `api/app/routers/vms.py`: VM inventory and lifecycle APIs (`/api/v1/vms`).
- `api/app/routers/clusters.py`: NKP cluster lifecycle APIs (`/api/v1/clusters`).
- `api/app/routers/fleet.py`: HQ read-only fleet aggregator APIs (`/api/v1/fleet`).
- `api/app/schemas/cli.py`: Pydantic request/response models.
- `api/app/schemas/pipeline.py`: Pydantic SSE event payload models.
- `api/app/schemas/vms.py`: VM API request/response schemas.
- `api/app/schemas/clusters.py`: NKP cluster API request/response schemas.
- `api/app/schemas/fleet.py`: Fleet snapshot and aggregate status schemas.
- `api/tests/test_cli_runner.py`: Async endpoint tests using `httpx.AsyncClient`.
- `api/tests/test_sse_stream.py`: SSE stream contract tests.
- `api/tests/test_vms.py`: VM router unit tests.
- `api/tests/test_clusters.py`: Cluster router unit tests.
- `api/tests/test_fleet.py`: Fleet aggregator router unit tests.

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

## Frontend Quickstart

```bash
cd ~/work/git/forge-central/ui
npm install
npm run dev
```

Frontend build and tests:

```bash
npm test
npm run build
```

## Automated Testing

Backend tests:

```bash
cd ~/work/git/forge-central
pytest api/tests/
```

Playwright Python E2E tests:

```bash
cd ~/work/git/forge-central
pip install -r api/requirements.txt -r tests/e2e/requirements-e2e.txt
cd ui && npm install && cd ..
python -m playwright install chromium --with-deps
pytest tests/e2e/ --browser chromium
```

For complete backend + UI testing flows, see `docs/TESTING-GUIDE.md`.

## Web Console Layout Skeleton

The React shell in `ui/src/components/layout/` includes:

- `Sidebar.jsx`: Left navigation for `/vms`, `/clusters`, `/fleet`, `/ipam`, `/settings` with active route highlighting, lab-site badge, and mode switcher (`Console` vs `Fleet`).
- `Header.jsx`: Control-plane mode badge (`Forge Central Console` or `Forge Fleet Dashboard`), system health indicator, and `⌘K` search trigger.
- `Layout.jsx`: Shared shell that renders `Sidebar`, `Header`, and route content via React Router `<Outlet />`.

Pages under `ui/src/pages/` expose deterministic `data-testid` selectors for automated UI tests.

`VmListPage.jsx` now includes VM inventory management with:

- Search by VM name/VMID and status/node filters.
- VM creation modal flow (`POST /api/v1/vms/create`).
- VM lifecycle controls (`start`, `stop`, `restart`, `destroy`).
- Typed destroy confirmation modal and GPU/PCI passthrough indicators.

`ClustersPage.jsx` now includes NKP cluster operations with:

- Cluster inventory cards and table backed by `GET /api/v1/clusters`.
- Search input (`data-testid="input-cluster-search"`), status badges, node readiness progress, and MetalLB VIP range display.
- Cluster deployment launcher button (`data-testid="btn-open-deploy-cluster"`) that routes to `/clusters/deploy`.
- Typed destructive confirmation modal (`data-testid="modal-confirm-cluster-delete"`) for `DELETE /api/v1/clusters/{name}`.

`FleetDashboardPage.jsx` now includes read-only multi-site telemetry with:

- HQ read-only banner and badge (`fleet-banner-readonly`, `fleet-readonly-badge`).
- Refresh action (`btn-refresh-fleet`) calling `GET /api/v1/fleet/status`.
- Aggregate counters for sites, clusters, VMs, and GPU nodes.
- Site cards for `amd-lab`, `cirra-lab`, and `ntx-lab` with status, inventory counts, IPAM utilization, and last-sync metadata.

## Live Pipeline Terminal

- `ui/src/hooks/useEventSource.js` manages SSE connection lifecycle with reconnect behavior.
- `ui/src/components/common/LiveTerminal.jsx` renders real-time stdout/stderr output, line numbers, stderr highlighting, status/elapsed metadata, and copy/auto-scroll controls.

## Environment Variables

- `FORGE_BIN`: Absolute or relative path to the forge executable. Default is `./forge` from the current working directory.
