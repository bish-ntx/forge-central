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
- `api/app/routers/vms.py` / `api/app/services/passthrough.py`: hardware & GPU passthrough manager wrapping `./forge discover hardware`, `passthrough list|attach|detach` and `provision gpu-vms` (`GET /api/v1/vms/hardware/pci`, `POST /api/v1/vms/{vmid}/passthrough/attach|detach` with a VM power-state guard, `POST /api/v1/vms/provision-gpu`). UI: PCI Hardware Inventory drawer on `/vms` (`ui/src/components/vms/HardwarePciDrawer.jsx`) and GPU Workers card on `/clusters/:name` (`ui/src/components/cluster/GpuWorkersSection.jsx`). Tests: `api/tests/test_passthrough_hardware.py`.
- `api/app/routers/clusters.py`: NKP cluster lifecycle APIs (`/api/v1/clusters`).
- `api/app/routers/diagnostics.py`: Day-0 diagnostics capture APIs (`/api/v1/diagnostics`).
- `api/app/routers/audit.py`: Operational audit trail APIs (`/api/v1/audit`).
- `api/app/routers/fleet.py`: HQ read-only fleet aggregator APIs (`/api/v1/fleet`).
- `api/app/routers/cli.py`: Also exposes CLI schema reflection (`GET /api/v1/cli/schema/{verb}`) and snippet generation (`POST /api/v1/cli/generate-snippet`).
- `api/app/routers/paths.py`: Path inspection and state directory migration APIs (`/api/v1/settings/paths`).
- `api/app/routers/backup.py` / `api/app/services/backup.py`: Atomic state backup archives (`POST /api/v1/backup/create`, `GET /api/v1/backup/list`).
- `api/app/routers/restore.py` / `api/app/services/restore.py`: Archive integrity verification and 1-click state restore (`POST /api/v1/restore/verify`, `POST /api/v1/restore/execute`).
- `api/app/routers/clusters.py` / `api/app/services/cluster_config.py`: guided cluster config generator & bastion remote sync (`POST /api/v1/clusters/init-config`, `POST /api/v1/clusters/sync-bastion`, wizard flow of `POST /api/v1/clusters/create`) chaining `./forge init nkp-cluster`, `provision vms`, `create cluster` and `share mount` over one SSE run. UI: `ui/src/pages/ClusterDeployPage.jsx` (`/clusters/deploy`).
- `api/app/routers/ipam.py` / `api/app/services/ipam.py`: IPAM ledger & subnet manager wrapping `./forge ipam` (`GET /api/v1/ipam`, `GET /api/v1/ipam/free`, `POST /api/v1/ipam/release`, `POST /api/v1/ipam/reconcile`). UI: `ui/src/pages/IpamPage.jsx` (`/ipam`).
- `api/app/routers/lab.py` / `api/app/services/lab.py`: Day-0 lab wizard (`GET /api/v1/lab/config`, `POST /api/v1/lab/init`, admin only) writing `FORGE_HOME/labs/<lab>/<lab>-infra.ini`.
- `api/app/routers/secrets.py` / `api/app/services/secrets.py`: Registry secrets vault (`GET /api/v1/secrets`, `POST /api/v1/secrets/save`, `DELETE /api/v1/secrets/{sec_type}`; mutations admin only) staging chmod 600 INIs under `FORGE_CACRT_DIR`.
- `ui/src/components/auth/LoginGatewayModal.jsx`: first-visit gateway (Operator/Viewer quick entry or Admin passphrase unlock).
- `api/app/routers/nodes.py`: Node prep and NFS share APIs (`POST /api/v1/nodes/prep`, `POST /api/v1/shares/mount`, `GET /api/v1/shares/status`).
- `api/app/schemas/nodes.py`: Node prep and share request/response schemas.
- `api/tests/test_nodes.py`: Node prep and share router unit tests.
- `api/app/schemas/paths.py`: Path status and migration request/response schemas.
- `api/tests/test_paths.py`: Path settings router unit tests.
- `api/app/schemas/cli.py`: Pydantic request/response models.
- `api/app/schemas/pipeline.py`: Pydantic SSE event payload models.
- `api/app/schemas/vms.py`: VM API request/response schemas.
- `api/app/schemas/clusters.py`: NKP cluster API request/response schemas.
- `api/app/schemas/diagnostics.py`: Diagnostics capture and support bundle schemas.
- `api/app/schemas/audit.py`: Audit log entry/list schemas.
- `api/app/schemas/fleet.py`: Fleet snapshot and aggregate status schemas.
- `api/tests/test_cli_runner.py`: Async endpoint tests using `httpx.AsyncClient`.
- `api/tests/test_sse_stream.py`: SSE stream contract tests.
- `api/tests/test_vms.py`: VM router unit tests.
- `api/tests/test_clusters.py`: Cluster router unit tests.
- `api/tests/test_diagnostics.py`: Diagnostics router unit tests.
- `api/tests/test_audit.py`: Audit router unit tests.
- `api/tests/test_fleet.py`: Fleet aggregator router unit tests.

## Quickstart

> **Note on Directory Paths:** In commands throughout this documentation, `~/forge-central` represents the default deployment directory on the Forge Central VM. If you are developing locally on a workstation (e.g. `~/work/git/forge-central` or another directory), adjust the path to your clone root accordingly.

```bash
cd ~/forge-central
python3 -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt
uvicorn api.app.main:app --reload --port 8000
```

OpenAPI docs are available at:

- `http://127.0.0.1:8000/docs`

## Frontend Quickstart

```bash
cd ~/forge-central/ui
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
cd ~/forge-central
pytest api/tests/
```

Playwright Python E2E tests:

```bash
cd ~/forge-central
pip install -r api/requirements.txt -r tests/e2e/requirements-e2e.txt
cd ui && npm install && cd ..
python -m playwright install chromium --with-deps
pytest tests/e2e/ --browser chromium
```

Full-stack hybrid E2E (wizard → IPAM → SSE → Proxmox/kubectl/helm audit): `./scripts/run-e2e-suite.sh --mode ui-only` (reports in `tests/e2e/reports/`), see `docs/E2E-PLAYWRIGHT-TESTING-GUIDE.md`.

For complete backend + UI testing flows, see `docs/TESTING-GUIDE.md`.

## Web Console Layout Skeleton

The React shell in `ui/src/components/layout/` includes:

- `CliSnippetCard.jsx`: Reusable "CLI Equivalent" card with one-click copy, used in cluster deploy, Create VM and Add Nodepool views.
- `Sidebar.jsx`: Left navigation for `/vms`, `/clusters`, `/diagnostics`, `/fleet`, `/ipam`, `/settings`, `/settings/paths` with active route highlighting, lab-site badge, and mode switcher (`Console` vs `Fleet`).
- `Header.jsx`: Control-plane mode badge (`Forge Central Console` or `Forge Fleet Dashboard`), system health indicator, and `⌘K` search trigger.
- `Layout.jsx`: Shared shell that renders `Sidebar`, `Header`, and route content via React Router `<Outlet />`.

Pages under `ui/src/pages/` expose deterministic `data-testid` selectors for automated UI tests.

`VmListPage.jsx` now includes VM inventory management with:

- Search by VM name/VMID and status/node filters.
- VM creation modal flow (`POST /api/v1/vms/create`).
- VM lifecycle controls (`start`, `stop`, `restart`, `destroy`).
- Multi-select batch lifecycle actions with a batch control bar and typed `DESTROY` confirmation (`POST /api/v1/vms/batch-action`; template cloning via `POST /api/v1/vms/clone-batch`).
- Typed destroy confirmation modal and GPU/PCI passthrough indicators.
- PCI Hardware Inventory drawer (`btn-open-hardware-inventory`) with GPU/Pensando NIC discovery, assignment badges and an Attach PCI Device modal that enforces VM power-state safety.

`ClustersPage.jsx` now includes NKP cluster operations with:

- Cluster inventory cards and table backed by `GET /api/v1/clusters`.
- Search input (`data-testid="input-cluster-search"`), status badges, node readiness progress, and MetalLB VIP range display.
- Cluster deployment launcher button (`data-testid="btn-open-deploy-cluster"`) that routes to `/clusters/deploy`.
- Typed destructive confirmation modal (`data-testid="modal-confirm-cluster-delete"`) for `DELETE /api/v1/clusters/{name}`.
- Add Nodepool modal (`modal-add-nodepool`) and 2-step Reset Nodes modal (`modal-confirm-reset-nodes`, type `RESET`) backed by `POST /api/v1/clusters/{name}/nodepools` and `POST /api/v1/clusters/{name}/reset-nodes`; `GET /api/v1/clusters/{name}/nodepools` lists pools.
- Cluster names link to `ClusterDetailPage.jsx` (`/clusters/:name`) showing nodes, nodepools with scale controls, and Add/Reset/Delete actions.

`FleetDashboardPage.jsx` now includes read-only multi-site telemetry with:

- HQ read-only banner and badge (`fleet-banner-readonly`, `fleet-readonly-badge`).
- Refresh action (`btn-refresh-fleet`) calling `GET /api/v1/fleet/status`.
- Aggregate counters for sites, clusters, VMs, and GPU nodes.
- Site cards for `amd-lab`, `cirra-lab`, and `ntx-lab` with status, inventory counts, IPAM utilization, and last-sync metadata.

`DiagnosticsPage.jsx` now includes synthetic Day-0 diagnostics tooling with:

- Support bundle capture card and cluster input (`btn-capture-diagnostics`, `input-diagnostics-cluster`).
- Support bundle inventory table (`table-diagnostic-bundles`) from `GET /api/v1/diagnostics/bundles`.
- Operational audit table (`table-audit-logs`) from `GET /api/v1/audit/logs`.
- Deterministic fallback rows when backend APIs are unavailable.

## Live Pipeline Terminal

- `ui/src/hooks/useEventSource.js` manages SSE connection lifecycle with reconnect behavior.
- `ui/src/components/common/LiveTerminal.jsx` renders real-time stdout/stderr output, line numbers, stderr highlighting, status/elapsed metadata, and copy/auto-scroll controls.

## Docker Deployment

Forge Central ships as a single multi-stage image (Node 20 UI build + Python 3.11 FastAPI runtime). FastAPI serves the compiled UI from `/app/ui/dist` after all API routes.

```bash
docker build -t forge-central:latest .
docker run -d -p 8000:8000 -v ~/forge-state:/forge-state -v ~/forge-data:/forge-data -v ~/cacrt:/cacrt forge-central:latest
# or
docker compose up -d --build
```

Host SSH keys are mounted read-only at `/staging/ssh-key` (`SSH_KEY_DIR`, default `~/.ssh`); `docker-entrypoint.sh` copies them into the container's own `/home/forgecentral/.ssh` (owner UID 1000, dirs `700`, files `600`) and drops to `forgecentral` via `gosu`, so host permissions never need changing.

Open `http://localhost:8000`. See `docs/DEPLOYMENT-GUIDE.md` for volumes, environment variables and health checks.

## Dedicated VM Bootstrapping on Proxmox VE

Forge Central includes an automated Proxmox VM provisioner `scripts/bootstrap-forge-central-vm.sh` and comprehensive operator SOP `docs/BOOTSTRAP-FORGE-CENTRAL-VM.md`:

```bash
# Auto bring-up (Option A clone if template 100 exists; fallback to Option B scratch)
./scripts/bootstrap-forge-central-vm.sh --pve-host 10.123.238.110

# Supply your own SSH keypair (or env FORGE_SSH_KEY_FILE / FORGE_SSH_PUBKEY_FILE)
./scripts/bootstrap-forge-central-vm.sh --ssh-key-file ~/.ssh/id_nkpadmin_ecdsa --ssh-pubkey-file ~/.ssh/id_nkpadmin_ecdsa.pub

# Interactive wizard (also starts when run with no arguments on a TTY)
./scripts/bootstrap-forge-central-vm.sh --interactive

# Static IP + DNS, fully non-interactive
./scripts/bootstrap-forge-central-vm.sh --pve-host 10.123.238.110 --ip 10.123.238.150/24,gw=10.123.238.1 \
  --nameserver "10.40.64.15 8.8.8.8" --searchdomain nutanix.com --non-interactive

# Print copy-pasteable manual Proxmox CLI runbook with interpolated variables
./scripts/bootstrap-forge-central-vm.sh --print-manual-steps
```

**Interactive wizard.** `--interactive` (`-i`) or running the script with no arguments on a TTY walks you through host, sizing, DHCP/static IP, DNS (`--nameserver`, `--searchdomain`) and two SSH keys: **Key A** (your workstation public key, authorized for `nkpadmin`) and optional **Key B** (a shared inter-VM cluster keypair; blank = the VM generates one and stages it in `/home/nkpadmin/ssh-key/`). Safety stops: the Proxmox host has no default (blank aborts), and a summary table requires an explicit `yes`/`y` (default `no`) before anything runs. If key-based SSH to Proxmox fails, it offers a masked password prompt with `ssh-copy-id` or `sshpass`. Flags (`--non-interactive`, `--dry-run`, `--print-manual-steps`) never prompt.

No SSH key material is stored in the script. Keys come from `--ssh-key-file`, `--ssh-pubkey-file`, `--ssh-private-key`, `--ssh-public-key` (or `FORGE_SSH_KEY_FILE`, `FORGE_SSH_PUBKEY_FILE`, `FORGE_SSH_PRIVATE_KEY`, `FORGE_SSH_PUBLIC_KEY`). With no public key the script authorizes your local `~/.ssh/id_ed25519.pub`, `id_ecdsa.pub` or `id_rsa.pub`; with no private key the VM generates its own ECDSA keypair on first boot. Password login (`nkpadmin` / `Nutanix.123`) and `ssh-copy-id` keep working.

See [docs/BOOTSTRAP-FORGE-CENTRAL-VM.md](docs/BOOTSTRAP-FORGE-CENTRAL-VM.md) for architecture sizing, clone vs. scratch workflows, manual command runbooks, and Day-1 verification.

## Air-Gapped Release Bundle

Build a self-contained `forge-central-v<VERSION>.tar.gz` (plus `.sha256`) with `scripts/build-release-bundle.sh [--version V] [--output-dir DIR] [--dry-run]`, then inspect it in the Web Console at `/settings/upgrade` (`POST /api/v1/upgrade/inspect`). See `docs/DEPLOYMENT-GUIDE.md`.

## Environment Variables

- `FORGE_BIN`: Absolute or relative path to the forge executable. Default is `./forge` from the current working directory.
- `FORGE_MOCK_MODE`: Set to `true` to run offline with synthetic VMs, clusters, NFS shares and simulated `./forge` runs (no Proxmox or Kubernetes needed). Default is `false`.
- `FORGE_DISPLAY_TZ`: IANA zone used only for the local half of the dual-timestamp log headers. Default is `America/Los_Angeles`. All stored/API timestamps remain ISO 8601 UTC (`...Z`); the web console has a Local/UTC toggle (`button-timezone-toggle`).
- `FORGE_OTEL_ENABLED` / `FORGE_OTEL_COLLECTOR_URL`: lightweight telemetry exporter flag (default `false`) and OTLP/HTTP collector URL (default `http://localhost:4318`) reported by `GET /api/v1/telemetry/status`. Test runs ingested via `POST /api/v1/telemetry/ingest/test-run` are stored under `$FORGE_DATA_DIR/telemetry/` and surfaced in the Qualification Matrix (`/analytics/correlation`).
- `FORGE_ADMIN_PASSWORD`: passphrase that unlocks the `admin` console role via `POST /api/v1/auth/unlock-admin`. Default is `Nutanix.123`; override it for any shared deployment. Roles: `viewer` (read-only demo), `operator` (default), `admin` (Day-0 setup).
- `FORGE_CACRT_DIR`: directory for staged registry credentials (`dockerhub/dockerhub-creds.ini`, `<cluster>/harbor-creds.ini`). Default is `~/cacrt`.
- `FORGE_STATE_DIR`: directory holding generated cluster configs (`<cluster>/<cluster>-input.ini`). Default is `~/forge-state`.
- `FORGE_CENTRAL_IP`: Forge Central address that bastions mount product shares from (`./forge share mount --from <ip>`). Auto-detected towards the bastion when unset.
- `FORGE_BASTION_USER` / `FORGE_BASTION_FORGE_PATH` / `FORGE_BASTION_STATE_DIR`: SSH user (`nkpadmin`), forge CLI path (`nkp-forge/forge`) and state directory (`forge-state`) on cluster bastions; the paths are relative to the bastion user's `$HOME`.
- `PORT`: (Compose only) host port mapped to container port 8000. Default is `8000`.
- `FORGE_HOME`: Forge state directory. Container default is `/forge-state`.
