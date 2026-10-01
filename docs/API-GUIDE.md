# Forge Central API Guide

## Base Routes

### `GET /health`

Returns service liveness with forge binary path metadata and whether synthetic mock mode is active.

Example response:

```json
{
  "status": "healthy",
  "forge_bin": "/path/to/forge",
  "mock_mode": false
}
```

### Synthetic Mock Mode (`FORGE_MOCK_MODE=true`)

Run the API 100% offline, with no Proxmox hypervisor or Kubernetes cluster:

```bash
FORGE_MOCK_MODE=true uvicorn api.app.main:app
```

- `/health` returns `"mock_mode": true`.
- Every run started through `ProcessRunner` (pipeline, VM, cluster, node, share actions) is simulated instead of spawning `./forge`: synthetic stage banners, clone progress, IP allocation and etcd quorum lines stream over SSE (20-50ms apart), then `event: end` with `exit_code: 0` / `COMPLETED`.
- `GET /api/v1/vms` returns 6 sample VMs (`cp-01..03`, `wk-01..02`, and `gpu-01` with PCI passthrough).
- `GET /api/v1/clusters` returns `amd-nkp1` (`ready`) and `cirra-nkp1` (`deploying`).
- `GET /api/v1/shares/status` returns the `~/nkp-forge`, `~/forge-state` and `~/cacrt` exports.
- Runs are also simulated (without the env flag) when `--mock` is in the CLI args or the `forge` binary is missing or not executable.

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

## VM Management API

### `GET /api/v1/vms`

Returns active VM inventory records from forge CLI JSON output.

Query parameters:

- `node` (optional): filter by node name.
- `status` (optional): `running` or `stopped`.

Example:

```bash
curl -s "http://127.0.0.1:8000/api/v1/vms?status=running"
```

Example response:

```json
{
  "vms": [
    {
      "vmid": 101,
      "name": "gpu-vm-01",
      "node": "pve-a",
      "cores": 8,
      "memory_mb": 16384,
      "disk_gb": 200,
      "status": "running",
      "gpu_passthrough": true,
      "pci_devices": ["0000:65:00.0"]
    }
  ]
}
```

### `POST /api/v1/vms/create`

Queues VM provisioning in forge CLI.

Request schema:

```json
{
  "name": "gpu-vm-02",
  "node": "pve-b",
  "cores": 8,
  "memory_mb": 16384,
  "disk_gb": 120,
  "hypervisor_type": "proxmox"
}
```

Example:

```bash
curl -s -X POST "http://127.0.0.1:8000/api/v1/vms/create" \
  -H "Content-Type: application/json" \
  -d '{"name":"gpu-vm-02","node":"pve-b","cores":8,"memory_mb":16384,"disk_gb":120,"hypervisor_type":"proxmox"}'
```

### `POST /api/v1/vms/{vmid}/action`

Queues VM lifecycle action for a specific VM.

Request schema:

```json
{
  "action": "restart"
}
```

Valid action values: `start`, `stop`, `restart`, `destroy`.

Example:

```bash
curl -s -X POST "http://127.0.0.1:8000/api/v1/vms/101/action" \
  -H "Content-Type: application/json" \
  -d '{"action":"stop"}'
```

### `POST /api/v1/vms/pci-passthrough`

Queues PCI device passthrough mapping to target VM.

Request schema:

```json
{
  "vmid": 101,
  "pci_id": "0000:65:00.0",
  "hostpci_index": 0
}
```

Example:

```bash
curl -s -X POST "http://127.0.0.1:8000/api/v1/vms/pci-passthrough" \
  -H "Content-Type: application/json" \
  -d '{"vmid":101,"pci_id":"0000:65:00.0","hostpci_index":0}'
```

### `POST /api/v1/vms/batch-action`

Queues one lifecycle action (`start`, `stop`, `restart`, `destroy`) for multiple VMs via `forge vm-batch-action`. Returns `202` and records a `vm-batch-{action}` audit event. For `action: "destroy"` a pre-mutation safety snapshot (`safety-vm-batch-destroy-<N>-vms-<timestamp>-<id>.tar.gz`) is created first and its ID returned as `safety_backup_id` (`null` for other actions).

Request schema:

```json
{
  "vmids": [101, 102],
  "action": "stop"
}
```

Response:

```json
{
  "run_id": "3f2b8c1e-0d4a-4c55-9a51-2a7d6e9f1b10",
  "status": "PENDING",
  "action": "stop",
  "affected_vmids": [101, 102],
  "started_at": "2026-09-30T23:30:00Z"
}
```

Example:

```bash
curl -s -X POST "http://127.0.0.1:8000/api/v1/vms/batch-action" \
  -H "Content-Type: application/json" \
  -d '{"vmids":[101,102],"action":"stop"}'
```

### `POST /api/v1/vms/clone-batch`

Queues cloning of a template into `count` VMs via `forge vm-clone-batch`. Returns `202` and records a `vm-clone-batch` audit event.

Request schema:

```json
{
  "template_id": 9000,
  "count": 3,
  "base_name": "worker",
  "node": "pve-a",
  "start_vmid": null
}
```

Response fields: `run_id`, `status`, `command`, `created_vms` (list, empty until the run reports results), `started_at`.

Example:

```bash
curl -s -X POST "http://127.0.0.1:8000/api/v1/vms/clone-batch" \
  -H "Content-Type: application/json" \
  -d '{"template_id":9000,"count":3,"base_name":"worker"}'
```

## Hardware Discovery, GPU Passthrough & GPU VM Provisioning API (Task-28)

These endpoints wrap `./forge discover hardware`, `./forge passthrough list|attach|detach` and `./forge provision gpu-vms`. All write operations are delegated to the forge CLI (queued as a run; stream logs via `GET /api/v1/pipeline/{run_id}/stream`). `attach`, `detach` and `provision-gpu` require the Operator/Admin role (`X-Forge-Role: viewer` → `403`).

### `GET /api/v1/vms/hardware/pci`

Lists discovered GPUs (AMD MI350P / NVIDIA) and Pensando (Pollara) NICs with their current VM assignment. Live mode runs `./forge discover hardware --details` (falling back to `lspci -D` when the CLI yields no devices) plus `./forge passthrough list`; with `FORGE_MOCK_MODE=true` deterministic fixtures are returned (4× AMD Instinct MI350P at `0000:05|25|45|65:00.0`, 4× Pensando Pollara 400 at `0000:07|27|47|67:00.0`; `0000:05:00.0`/`0000:07:00.0` are held by `gpu-wk-01` (301) and `0000:25:00.0`/`0000:27:00.0` by `gpu-wk-02` (302)). Only GPU and Pensando NIC devices are returned. `500` when discovery fails.

```json
{
  "pci_devices": [
    {
      "pci_bdf": "0000:05:00.0",
      "device_type": "gpu",
      "description": "Display controller: Advanced Micro Devices, Inc. [AMD/ATI] Instinct MI350P [1002:75a0]",
      "vendor": "AMD",
      "assigned_vmid": 301,
      "assigned_vm_name": "gpu-wk-01"
    }
  ],
  "total_gpus": 4,
  "total_nics": 4,
  "discovered_at": "2026-09-30T21:00:00Z"
}
```

`device_type` is `gpu`, `nic` or `other`; `assigned_vmid` / `assigned_vm_name` are `null` for free devices.

### `POST /api/v1/vms/{vmid}/passthrough/attach` and `/detach`

Queues `./forge passthrough attach|detach --vmid <vmid> --device <device_type> [--stop]` and returns `202` (`run_id`, `status`, `command`, `action`, `vmid`, `device_type`, `force_stop`, `started_at`). Records the `passthrough-attached` / `passthrough-detached` audit event.

```json
{ "device_type": "gpu", "pci_bdf": "0000:65:00.0", "force_stop": false }
```

| Field | Type | Notes |
|-------|------|-------|
| `device_type` | `gpu` \| `nic` \| `both` | default `gpu` (`422` otherwise) |
| `pci_bdf` | string, optional | `dddd:bb:ss.f`; exported to the CLI as `GPU_PCIE_DEVICE` (`gpu`) or `PENSANDO_NIC_PCIE_DEVICE` (`nic`); not allowed with `both` (`400`) |
| `force_stop` | bool | default `false`; adds `--stop` |
| `vmid` | int, optional | informational; the path value is authoritative |

Safety checks (before anything is queued):

- `404` when the VM does not exist or `pci_bdf` was not discovered on the host.
- **`409` power-state guard** when the VM is `running` and `force_stop` is `false`; with `force_stop=true` the CLI stops the VM first and never auto-starts it.
- `400` when `pci_bdf` is the wrong class for `device_type` (e.g. a NIC BDF with `gpu`).
- `409` on attach when `pci_bdf` is already assigned to another VM.

```bash
curl -s -X POST "http://127.0.0.1:8000/api/v1/vms/303/passthrough/attach" \
  -H "Content-Type: application/json" \
  -d '{"device_type":"gpu","pci_bdf":"0000:65:00.0"}'
```

### `POST /api/v1/vms/provision-gpu`

Dispatches `./forge provision gpu-vms --conf <FORGE_STATE_DIR>/<cluster>/<cluster>-input.ini` to clone 300-series GPU worker VMs (cloud-init overlay, AMD GPU + Pensando Pollara NIC passthrough, power on). Returns `202` with `run_id`, `status`, `command`, `cluster_name`, `gpu_worker_count`, `conf_path`, `started_at` and records the `gpu-vms-provisioned` audit event.

```json
{ "cluster_name": "amd-nkp1", "gpu_worker_count": 2, "gpu_bdf": "0000:65:00.0", "nic_bdf": "0000:67:00.0" }
```

- `gpu_worker_count` (1–16, default `1`) is exported as `GPU_WORKER_COUNT`; `gpu_bdf` / `nic_bdf` (optional) as `GPU_PCIE_DEVICE` / `PENSANDO_NIC_PCIE_DEVICE`. When omitted the values from the cluster config apply.
- `404` when the cluster INI has not been generated by `POST /api/v1/clusters/init-config` (the check is skipped in mock mode); `422` for an invalid cluster name or BDF; `409` when a chosen BDF is already assigned; `400` when a BDF has the wrong device class.

```bash
curl -s -X POST "http://127.0.0.1:8000/api/v1/vms/provision-gpu" \
  -H "Content-Type: application/json" \
  -d '{"cluster_name":"amd-nkp1","gpu_worker_count":2}'
```

## NKP Cluster Management API

### `GET /api/v1/clusters`

Returns cluster inventory records from forge CLI JSON output.

Response schema:

```json
{
  "clusters": [
    {
      "name": "nkp-prod-01",
      "status": "ready",
      "kubernetes_version": "v1.31.1",
      "desired_nodes": 6,
      "ready_nodes": 6,
      "metallb": {
        "vip_range": "10.10.40.100-10.10.40.120",
        "address_pool": "prod-pool"
      }
    }
  ]
}
```

### `POST /api/v1/clusters/create`

Queues the preprovisioned NKP pipeline (`01-preprov-create-nkp-cluster-konvoy.sh` through `05-preprov-validate-cluster.sh`).

Request schema:

```json
{
  "cluster_name": "nkp-prod-01",
  "control_plane_nodes": 3,
  "worker_nodes": 3,
  "kubernetes_version": "v1.31.1",
  "hypervisor_type": "proxmox"
}
```

With only the fields above the legacy pipeline is queued. Adding `lab_name` switches to the **guided wizard flow** (see [Guided Cluster Deployment API](#guided-cluster-deployment-api-task-27)): a single run chains `./forge provision vms` and `./forge create cluster` against the `<cluster>-input.ini` generated by `init-config`, with live SSE progress.

### `GET /api/v1/clusters/{name}`

Returns detailed cluster metadata including node status and MetalLB VIP configuration.

Example response:

```json
{
  "cluster": {
    "name": "nkp-prod-01",
    "status": "ready",
    "kubernetes_version": "v1.31.1",
    "desired_nodes": 6,
    "ready_nodes": 6,
    "metallb": {
      "vip_range": "10.10.40.100-10.10.40.120",
      "address_pool": "prod-pool"
    }
  },
  "nodes": [
    { "name": "nkp-prod-01-cp-1", "role": "control-plane", "status": "ready" },
    { "name": "nkp-prod-01-md-1", "role": "worker", "status": "ready" }
  ]
}
```

### `DELETE /api/v1/clusters/{name}`

Queues cluster deletion for workload or management clusters. Before the deletion run starts, an automatic safety snapshot (`safety-cluster-delete-<name>-<timestamp>-<id>.tar.gz` plus `.sha256`) is written to `FORGE_BACKUP_DIR` and its ID is returned as `safety_backup_id`. The snapshot is audited as `safety-snapshot-created` and can be restored via `/api/v1/restore/execute`.

Example:

```bash
curl -s -X DELETE "http://127.0.0.1:8000/api/v1/clusters/nkp-prod-01"
```

### `POST /api/v1/clusters/{name}/nodepools`

Queues nodepool creation/scale operation through preprovisioned nodepool workflow.

Request schema:

```json
{
  "nodepool_name": "md-gpu",
  "replicas": 3,
  "hypervisor_type": "proxmox"
}
```

Also updates the in-memory nodepool state, so an existing pool is rescaled and a new pool is appended.

### `GET /api/v1/clusters/{name}/nodepools`

Returns the cluster nodepools. Default seed: `worker-pool-1` (3 replicas) and `worker-pool-2` (2 replicas); pools created or scaled via `POST /nodepools` are reflected.

Response schema (`ClusterNodepoolListResponse`):

```json
{
  "nodepools": [
    { "name": "worker-pool-1", "replicas": 3, "hypervisor_type": "proxmox", "status": "ready" }
  ]
}
```

### `POST /api/v1/clusters/{name}/reset-nodes`

Queues `preprov-reset-nodes.sh` for the cluster and records a `cluster-reset-nodes` entry in the audit trail (`GET /api/v1/audit/logs`). Returns `202` with a `ClusterCommandResponse`. A safety snapshot (`safety-reset-nodes-<name>-<timestamp>-<id>.tar.gz`) is created before the reset run and returned as `safety_backup_id`.

Optional request body (omit to reset all nodes):

```json
{ "node_names": ["worker-1", "worker-2"] }
```

```bash
curl -s -X POST "http://127.0.0.1:8000/api/v1/clusters/amd-nkp1/reset-nodes"
```

## Diagnostics & Audit API

### `POST /api/v1/diagnostics/capture`

Captures a synthetic Day-0 support bundle and records an audit event.

Request schema:

```json
{
  "cluster_name": "amd-nkp1",
  "include_logs": true,
  "node_names": ["amd-nkp1-cp-1", "amd-nkp1-md-1"]
}
```

Example response:

```json
{
  "bundle_id": "bundle-amd-nkp1-20260926120000",
  "cluster_name": "amd-nkp1",
  "filename": "bundle-amd-nkp1-20260926120000.tar.gz",
  "file_size_bytes": 93000000,
  "status": "ready",
  "captured_at": "2026-09-26T12:00:00+00:00",
  "download_url": "/api/v1/diagnostics/bundles/bundle-amd-nkp1-20260926120000"
}
```

### `GET /api/v1/diagnostics/bundles`

Returns available synthetic support bundles.

### `GET /api/v1/diagnostics/bundles/{bundle_id}`

Returns support bundle metadata for a single bundle ID.

- Returns `404` with `{"detail":"support bundle not found: <bundle_id>"}` when unknown.

### `GET /api/v1/audit/logs`

Returns operational audit events for Day-0 activities.

Query parameters:

- `verb` (optional): filter by operation verb, such as `diagnostics-capture`.
- `status` (optional): filter by run status, such as `succeeded` or `failed`.

Example:

```bash
curl -s "http://127.0.0.1:8000/api/v1/audit/logs?status=succeeded"
```

Example response:

```json
{
  "logs": [
    {
      "run_id": "run-diag-capture-cirra-nkp1",
      "timestamp": "2026-09-26T12:33:19+00:00",
      "verb": "diagnostics-capture",
      "user": "sre-oncall",
      "status": "succeeded",
      "duration_sec": 23.5,
      "details": {
        "cluster_name": "cirra-nkp1",
        "bundle_id": "bundle-cirra-nkp1-20260925"
      }
    }
  ],
  "total_count": 1
}
```

### `GET /api/v1/pipeline/{run_id}/stream`

Streams pipeline logs over Server-Sent Events (SSE) for a previously started run.

- Requires a valid `run_id` from `POST /api/v1/cli/execute`.
- Returns `404` if the run is unknown.
- Uses `text/event-stream` with named events:
  - `event: log`
  - `event: end`

`log` event payload:

```json
{
  "timestamp": "2026-09-26T22:40:01.100000+00:00",
  "line": "step 01 complete",
  "stream": "stdout"
}
```

`end` event payload:

```json
{
  "exit_code": 0,
  "status": "COMPLETED"
}
```

Wire format example:

```text
event: log
data: {"timestamp":"2026-09-26T22:40:01.100000+00:00","line":"step 01 complete","stream":"stdout"}

event: end
data: {"exit_code":0,"status":"COMPLETED"}
```

## Preprovisioned Inventory Inspection API

### `GET /api/v1/inventory/list`

Returns available PreprovisionedInventory INI/YAML manifest files in `FORGE_DATA_DIR` (`~/forge-data/`).

Example response:

```json
{
  "files": [
    {
      "filename": "inventory-lab-01.yaml",
      "node_count": 5,
      "control_plane_count": 3,
      "worker_count": 2
    }
  ]
}
```

### `GET /api/v1/inventory/{filename}`

Returns raw manifest YAML content and parsed node topology counts.

Example response:

```json
{
  "filename": "inventory-lab-01.yaml",
  "raw_yaml": "apiVersion: infrastructure.cluster.x-k8s.io/v1alpha1\nkind: PreprovisionedInventory\n...",
  "node_count": 5,
  "control_plane_nodes": ["10.10.40.11", "10.10.40.12", "10.10.40.13"],
  "worker_nodes": ["10.10.40.21", "10.10.40.22"]
}
```

### `POST /api/v1/inventory/validate`

Executes pre-flight inventory health checks (wrapping `preprov-diagnose.sh`).

Request schema:

```json
{
  "filename": "inventory-lab-01.yaml"
}
```

## Fleet Aggregator API (HQ Read-Only)

### `GET /api/v1/fleet/status`

Returns all site telemetry snapshots plus aggregate fleet totals.

Example response:

```json
{
  "sites": [
    {
      "site_id": "amd-lab",
      "site_name": "AMD Lab",
      "location": "Santa Clara, CA",
      "status": "HEALTHY",
      "clusters_count": 2,
      "vms_count": 12,
      "ipam_utilization_pct": 45.0,
      "gpu_nodes_count": 4,
      "timestamp": "2026-09-26T23:00:00+00:00",
      "details": null,
      "last_seen": "2026-09-26T23:00:00+00:00"
    }
  ],
  "total_clusters": 6,
  "total_vms": 36,
  "total_gpu_nodes": 14,
  "hq_sync_status": "ONLINE"
}
```

### `POST /api/v1/fleet/snapshot`

Records or updates a single remote site telemetry snapshot.

Request schema:

```json
{
  "site_id": "amd-lab",
  "site_name": "AMD Lab",
  "location": "Santa Clara, CA",
  "status": "HEALTHY",
  "clusters_count": 2,
  "vms_count": 12,
  "ipam_utilization_pct": 45.0,
  "gpu_nodes_count": 4,
  "timestamp": "2026-09-26T23:00:00+00:00",
  "details": {
    "note": "nightly sync"
  }
}
```

Example response:

```json
{
  "status": "recorded",
  "site_id": "amd-lab",
  "recorded_at": "2026-09-26T23:00:02.123456+00:00"
}
```

### `GET /api/v1/fleet/sites/{site_id}`

Returns a single site status payload by site ID.

- Returns `404` with `{"detail":"site not found: <site_id>"}` when the site is unknown.

Example response:

```json
{
  "valid": true,
  "check_results": [
    {
      "name": "YAML Syntax & Kind Validation",
      "status": "pass",
      "message": "Valid PreprovisionedInventory manifest syntax."
    },
    {
      "name": "Control Plane Quorum",
      "status": "pass",
      "message": "Optimal etcd HA quorum with 3 control plane node(s)."
    },
    {
      "name": "Network Connectivity & IP Uniqueness",
      "status": "pass",
      "message": "All 5 node IP address formats valid and unique."
    }
  ]
}
```

## Path Settings & State Migration API

### `GET /api/v1/settings/paths`

Inspects `FORGE_HOME`, `FORGE_DATA_DIR`, `FORGE_CENTRAL_DATA_DIR`, `FORGE_BACKUP_DIR` and `FORGE_LOG_DIR` (resolved from environment variables of the same name) and reports existence, permissions and disk usage (`shutil.disk_usage`).

- `status` is `accessible` (exists and writable), `read-only`, or `missing`.

Example response:

```json
{
  "paths": [
    {
      "name": "FORGE_HOME",
      "path": "/home/forge/forge",
      "exists": true,
      "accessible": true,
      "writable": true,
      "status": "accessible",
      "free_bytes": 120000000000,
      "total_bytes": 500000000000
    }
  ]
}
```

### `POST /api/v1/settings/paths/migrate`

Copies `*.ini`, `*.yaml`, `*.json` and `*.log` files (recursively) from `source_dir` to `target_dir`, creating the target if needed. The source is not modified. Records a `paths-migrated` audit event.

Request:

```json
{ "source_dir": "~/forge-state", "target_dir": "~/forge-data", "dry_run": true }
```

- `dry_run=true` scans and reports only; nothing is written (`files_migrated` and `bytes_migrated` are `0`).
- Returns `400` with `{"detail": "..."}` when the source directory does not exist or equals the target.

Example response:

```json
{
  "success": true,
  "dry_run": true,
  "source_dir": "/home/forge/forge-state",
  "target_dir": "/home/forge/forge-data",
  "files_scanned": 3,
  "files_migrated": 0,
  "bytes_migrated": 0,
  "migrated_files": ["forge.ini", "sub/inv.yaml", "run.log"],
  "message": "Would migrate 3 file(s) (42 bytes) from /home/forge/forge-state to /home/forge/forge-data"
}
```

## State Backup API

### `POST /api/v1/backup/create`

Bundles the Forge Central data directory (`FORGE_CENTRAL_DATA_DIR`, falling back to `~/forge-state`), `~/cacrt/` and `forge-central.db` (when present) into `forge-central-backup-{timestamp}-{short_uuid}.tar.gz` inside `FORGE_BACKUP_DIR` (created if missing). `*.log` files are excluded. A companion `.sha256` file is written and a `backup-created` audit event is recorded.

Example response:

```json
{
  "backup_id": "forge-central-backup-20260930T170000Z-1a2b3c4d",
  "filename": "forge-central-backup-20260930T170000Z-1a2b3c4d.tar.gz",
  "file_size_bytes": 20480,
  "created_at": "2026-09-30T17:00:00Z",
  "checksum_sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "status": "completed"
}
```

### `GET /api/v1/backup/list`

Lists `*.tar.gz` archives in `FORGE_BACKUP_DIR`, newest first, as `{"backups": [ ...same fields as above without status... ]}`.

## State Restore API

### `POST /api/v1/restore/verify`

Request: `{"backup_id": "forge-central-backup-20260930T170000Z-1a2b3c4d"}` (a filename is also accepted; only the basename is used, so path traversal is impossible). Runs three pre-restore checks against the archive in `FORGE_BACKUP_DIR`: `archive-exists` (file present, `.tar.gz`), `checksum-match` (SHA-256 equals the companion `.sha256`) and `archive-integrity` (the tarball opens and lists members). Always returns `200`; inspect `valid`.

```json
{
  "valid": true,
  "backup_id": "forge-central-backup-20260930T170000Z-1a2b3c4d",
  "filename": "forge-central-backup-20260930T170000Z-1a2b3c4d.tar.gz",
  "manifest": {"checksum_sha256": "9f86...", "file_count": 12, "total_bytes": 20480, "entries": ["cacrt", "forge-central.db", "state"]},
  "checks": [{"name": "archive-exists", "passed": true, "message": "Archive found"}]
}
```

### `POST /api/v1/restore/execute`

Request: `{"backup_id": "..."}`. Re-runs verification (`400` with `{"detail": "Backup verification failed: ..."}` if invalid), takes an automatic pre-restore safety snapshot via the backup engine, then restores `state/*` and `forge-central.db` into `FORGE_CENTRAL_DATA_DIR` and `cacrt/*` into `~/cacrt/`. Each file is written to a temporary name and atomically swapped into place; absolute paths, `..` segments, symlinks and device nodes in the archive are skipped. Records a `state-restored` audit event.

```json
{"restore_id": "restore-1a2b3c4d", "restored_files_count": 12, "safety_backup_id": "forge-central-backup-20260930T171000Z-5e6f7a8b", "status": "completed"}
```

## IPAM Ledger & Subnet Manager API (`/api/v1/ipam`)

Wraps the `./forge ipam` CLI (`list`, `free`, `release`, `reconcile-vmids`). Live mode passes `--conf <FORGE_HOME>/labs/<lab>/<lab>-infra.ini` (the first discovered lab) and parses the CLI table output; the Proxmox-notes ledger stays the source of truth. With `FORGE_MOCK_MODE=true` a deterministic in-memory ledger for the pool `10.0.0.10-10.0.0.40` is served (gateway, control-plane VIPs, node IPs and free slots), and releases mutate it in memory. CLI failures return `500` with the CLI's stderr in `detail`.

### `GET /api/v1/ipam`

Full ledger. `status` is one of `allocated`, `free`, `vip`, `gateway`; `allocated_slots` counts every non-free slot, so `allocated_slots + free_slots == total_slots`.

```json
{
  "total_slots": 31,
  "allocated_slots": 8,
  "free_slots": 23,
  "ip_pool": "10.0.0.10-10.0.0.40",
  "slots": [
    {"ip": "10.0.0.10", "status": "gateway", "cluster": null, "vmid": null, "hostname": "lab-gateway", "role": "gateway"},
    {"ip": "10.0.0.11", "status": "vip", "cluster": "amd-nkp1", "vmid": null, "hostname": null, "role": "control-plane-vip"},
    {"ip": "10.0.0.12", "status": "allocated", "cluster": "amd-nkp1", "vmid": 1001, "hostname": "amd-nkp1-cp-01", "role": "control-plane"},
    {"ip": "10.0.0.15", "status": "free", "cluster": null, "vmid": null, "hostname": null, "role": null}
  ],
  "updated_at": "2026-09-30T20:00:00Z"
}
```

### `GET /api/v1/ipam/free`

Returns a JSON array of only the unassigned slots (same `IpamSlot` shape, `status: "free"`), backed by `forge ipam free`.

### `POST /api/v1/ipam/release`

Request: `{"cluster_name": "amd-nkp1"}` (1-63 chars of letters, digits, `.`, `_`, `-`; anything else is `422`). Requires the Operator or Admin role: `X-Forge-Role: viewer` gets `403`. Takes a pre-mutation safety snapshot, runs `./forge ipam release --cluster <cluster_name> --force` (the typed `RELEASE` confirmation in the UI replaces the CLI's y/N prompt), and records an `ipam-released` audit event. `404` if the cluster holds no reservation.

```json
{"released_count": 4, "cluster_name": "amd-nkp1", "status": "released", "safety_backup_id": "safety-ipam-release-amd-nkp1-20260930T200000Z-1a2b3c4d"}
```

### `POST /api/v1/ipam/reconcile`

Runs the read-only `./forge ipam reconcile-vmids` diff of the VMID ledger against live Proxmox state; nothing is modified. `status` is `in-sync` or `drift-detected`.

```json
{
  "discrepancies_found": 2,
  "details": [
    {"type": "claimed-but-not-live", "vmid": 1004, "hostname": "amd-nkp1-wk-03"},
    {"type": "live-but-not-claimed", "vmid": 1201, "hostname": "orphan-vm-01"}
  ],
  "status": "drift-detected"
}
```

## Air-Gapped Upgrade API

### `GET /api/v1/upgrade/status`

Returns the running version and host details.

```json
{ "current_version": "1.0.0", "last_upgrade_at": null, "arch": "arm64", "platform": "Darwin" }
```

### `POST /api/v1/upgrade/inspect`

Runs pre-flight checks on a release bundle built by `scripts/build-release-bundle.sh`. Request: `{"bundle_path": "/mnt/forge-central-v1.1.0.tar.gz"}`. Always returns `200`; failures are reported per check.

Checks (in order): `Bundle format` (existing `.tar.gz`), `Checksum` (SHA-256 vs companion `<bundle>.sha256`), `Version compatibility` (version in filename >= current), `Disk space` (> 1 GB free).

```json
{
  "valid": true,
  "current_version": "1.0.0",
  "bundle_version": "1.1.0",
  "checks": [
    {"name": "Bundle format", "passed": true, "message": "Found forge-central-v1.1.0.tar.gz"}
  ]
}
```

## CLI Schema Reflection & Snippet API

### `GET /api/v1/cli/schema/{verb}`

Returns the option schema of a core `./forge` verb. Recognized verbs: `provision-vms`, `create-cluster`, `reset-nodes`, `diagnose`, `share`, `secret`. Unknown verbs return `404` with `{"detail": "Unknown CLI verb: <verb>"}`.

Example response (`/api/v1/cli/schema/diagnose`):

```json
{
  "verb": "diagnose",
  "description": "Collect a diagnostics bundle for a cluster.",
  "arguments": [],
  "options": [
    {"name": "--cluster-name", "type": "string", "default": null, "description": "Cluster name.", "required": true},
    {"name": "--include-logs", "type": "boolean", "default": false, "description": "Include node logs in the bundle.", "required": false}
  ],
  "example": "./forge diagnose --cluster-name demo --include-logs"
}
```

### `POST /api/v1/cli/generate-snippet`

Builds a deterministic bash command for a verb. `params` keys are converted to flags (`cluster_name` becomes `--cluster-name`); `true` booleans render as a bare `--flag`, `false`/`null` values are omitted, other values render as `--key value` (shell-quoted). Unknown verbs return `404`.

Request:

```json
{ "verb": "create-cluster", "params": { "cluster_name": "demo", "control_plane_nodes": 3 } }
```

Response:

```json
{ "verb": "create-cluster", "command": "./forge create cluster --cluster-name demo --control-plane-nodes 3" }
```

## Node Prep & Share Management API

### `POST /api/v1/nodes/prep`

Dispatches `./forge prep node` (`forge-prep-node.sh`) through the process runner and records a `node-prep-dispatched` audit event. Returns `202`.

Request:

```json
{
  "address": "10.10.0.21",
  "ssh_user": "nutanix",
  "conf": "lab-config.ini",
  "node_type": "gpu-wk",
  "target_type": "baremetal",
  "admin_key": null,
  "dry_run": true
}
```

- `node_type`: `wk` | `cp` | `gpu-wk` | `bastion`. `target_type`: `vm` (default) | `baremetal`. Invalid values return `422`.
- `admin_key` (optional) adds `--admin-key`; `dry_run` adds `--dry-run`.

Response: `{ "run_id": "<uuid>", "status": "PENDING", "command": "./forge prep node --address ...", "started_at": "<iso8601>" }`. Follow output with `GET /api/v1/pipeline/{run_id}/stream`.

### `POST /api/v1/shares/mount`

Dispatches `./forge share mount` (`forge-share.sh`) and records a `share-mount-dispatched` audit event. Returns `202` with the same response shape as node prep.

Request: `{ "from_ip": "10.10.0.5", "path": "/srv/forge-share", "target_bastion": "bastion-01", "reboot": false, "dry_run": false }`. Only `from_ip` is required; `path`, `target_bastion`, `reboot` and `dry_run` add `--path`, `--target-bastion`, `--reboot` and `--dry-run`.

### `GET /api/v1/shares/status`

Returns configured NFS exports/mounts:

```json
{ "shares": [ { "export": "/srv/forge-share", "client": "bastion-01", "type": "nfs", "status": "mounted" } ] }
```

## Authentication & Role-Based Access Control (RBAC)

Forge Central has three console roles: `viewer` (read-only demo mode), `operator` (default; routine cluster, nodepool and VM actions) and `admin` (adds Day-0 infrastructure setup such as state migration, backups and restores). The role is chosen in the web console header; `admin` is unlocked with a passphrase.

### `POST /api/v1/auth/unlock-admin`

Validates the admin passphrase against the `FORGE_ADMIN_PASSWORD` environment variable (default `Nutanix.123` — override it in every real deployment). The passphrase is never logged.

Request:

```json
{ "passphrase": "Nutanix.123" }
```

Response `200`:

```json
{ "status": "authorized", "role": "admin" }
```

Returns `401` with `{"detail": "Invalid admin passphrase"}` when the passphrase does not match.

### `X-Forge-Role` request header (viewer guard)

The web console sends `X-Forge-Role: viewer|operator|admin` with destructive and Day-0 calls. Requests declaring `viewer` are rejected with `403` and `{"detail": "Viewer role cannot perform mutating actions"}` on:

- `DELETE /api/v1/clusters/{name}`
- `POST /api/v1/clusters/{name}/reset-nodes`
- `POST /api/v1/vms/batch-action` (any action, including `destroy`)
- `POST /api/v1/settings/paths/migrate`

Omitting the header or sending `operator`/`admin` keeps the previous behaviour (CLI and scripted clients are unaffected). The header is a UI-driven safety guard, not a substitute for network-level access control.

### Typed confirmation safeguards

The web console requires an exact, uppercase keyword before any destructive request is sent: `DELETE` (cluster delete), `RESET` (reset nodes), `DESTROY` (batch VM destroy) and `RESTORE` (state restore). Each destructive call also takes an automatic safety snapshot (see `safety_backup_id`).

## Day-0 Lab Wizard API (`/api/v1/lab`)

Lab infrastructure is stored as `FORGE_HOME/labs/<lab>/<lab>-infra.ini` (flat `KEY="value"` lines, chmod 600, same keys as `./forge init lab`). Mutations require `X-Forge-Role: admin`; any other role or a missing header returns `403` `{"detail": "Admin role required for Day-0 lab and secret changes"}`.

### `GET /api/v1/lab/config?lab=<name>`

Discovers labs under `FORGE_HOME/labs/` and parses the requested lab (or the first one found). With no labs on disk it returns `{"configured": false, "labs": [], ...defaults}`. `404` for an unknown `lab`. The Proxmox password is never returned; only `has_password`.

```json
{
  "configured": true, "lab_name": "amd-lab", "config_path": "/home/u/forge/labs/amd-lab/amd-lab-infra.ini",
  "labs": ["amd-lab"], "pve_host": "10.0.0.5", "pve_node": "pve1", "pve_user": "root", "has_password": true,
  "storage_pool": "local-lvm", "resource_pool": null, "network_bridge": "vmbr0", "nameserver": "10.0.0.1",
  "search_domain": null, "lab_ip_pool": "10.0.0.10-10.0.0.40", "golden_vmid": 100,
  "golden_name": "ubuntu-2404-golden", "registry_type": "dockerhub", "storage_mode": "local"
}
```

### `POST /api/v1/lab/init` (admin)

Validates and writes the lab-infra INI; an existing file is kept as `<lab>-infra.ini.bak` and an omitted `pve_password` keeps the existing one. Records the `lab-initialized` audit event (no secrets). Body fields: `lab_name`, `pve_host`, `pve_node`, `pve_user` (`root`), `pve_password`, `storage_pool`, `resource_pool`, `network_bridge` (`vmbr0`), `nameserver`, `search_domain`, `lab_ip_pool` (`10.0.0.10-10.0.0.40`), `golden_vmid` (`100`), `golden_name` (`ubuntu-2404-golden`), `registry_type` (`dockerhub|harbor|mirror`), `storage_mode` (`local`). Invalid lab names, IP pools, or values containing quotes/`$`/backticks/control characters return `422`. Response: `{"status": "initialized", "lab_name": "...", "config_path": "...", "updated_at": "...Z"}`. CLI equivalent: `./forge init lab --non-interactive --lab-name amd-lab --pve-host 10.0.0.5 ...`.

## Guided Cluster Deployment API (Task-27)

Powers the 5-stage wizard at `/clusters/deploy`: lab inheritance -> sizing & IPAM -> runner target -> config preview -> live execution. Infrastructure writes stay delegated to the `./forge` CLI (`init nkp-cluster`, `provision vms`, `create cluster`, `share mount`); the API renders the cluster INI and chains the CLI steps in one SSE-streamed run.

Settings (environment variables, never hardcoded paths): `FORGE_STATE_DIR` (default `~/forge-state`, where `<cluster>/<cluster>-input.ini` is written), `FORGE_CENTRAL_IP` (address bastions mount from; auto-detected towards the bastion when unset), `FORGE_BASTION_USER` (`nkpadmin`), `FORGE_BASTION_FORGE_PATH` (`nkp-forge/forge`, relative to the bastion's `$HOME`) and `FORGE_BASTION_STATE_DIR` (`forge-state`, relative to the bastion's `$HOME`).

`init-config`, `sync-bastion` and `create` reject `X-Forge-Role: viewer` with `403`.

### `POST /api/v1/clusters/init-config`

Discovers `FORGE_HOME/labs/<lab>/<lab>-infra.ini` (`404` for an unknown lab), writes `FORGE_STATE_DIR/<cluster>/<cluster>-input.ini` (chmod 600; an existing file is kept as `.bak`) and pre-selects a free control-plane VIP and MetalLB range from IPAM (`./forge ipam free`: first free address = VIP, the free run right after it, up to 5 addresses, = MetalLB range; blank values mean "let IPAM allocate"). Lab-level, non-secret values (Proxmox host/node/user, pools, bridge, DNS, IP pool, golden template) are inherited; `PVE_PASSWORD` is never copied. Records the `cluster-config-initialized` audit event.

```json
{
  "cluster_name": "nkp-prod-01", "lab_name": "amd-lab", "nkp_version": "v2.18.0",
  "registry_type": "dockerhub", "storage_mode": "local",
  "control_plane_nodes": 3, "worker_nodes": 3,
  "target_runner": "central", "bastion_ip": null, "hypervisor_type": "proxmox"
}
```

Validation (`422`): `cluster_name` is 1-63 chars of letters, digits, `.`, `_`, `-`; `lab_name` is alphanumeric with `-`/`_`; `registry_type` is `dockerhub|harbor|mirror`; `target_runner` is `central|bastion` and `bastion_ip` (plain IP/hostname, no shell characters) is required for `bastion`; `control_plane_nodes` 1-9; `worker_nodes` 0-64.

Response:

```json
{
  "cluster_name": "nkp-prod-01",
  "config_path": "/home/u/forge-state/nkp-prod-01/nkp-prod-01-input.ini",
  "vip_preview": "10.0.0.15",
  "metallb_range_preview": "10.0.0.16-10.0.0.20",
  "status": "initialized",
  "lab_name": "amd-lab",
  "config_preview": "LAB_ENV=\"...\"\nCLUSTER_NAME=\"nkp-prod-01\"\n...",
  "commands": [
    "./forge init nkp-cluster --cluster nkp-prod-01 --lab-infra <lab-infra.ini> --nkp-version v2.18.0 --registry-type dockerhub --storage-mode local --non-interactive --force",
    "./forge provision vms --skip-bastion --conf <input.ini>",
    "./forge create cluster --conf <input.ini>"
  ],
  "free_ip_count": 8
}
```

`config_preview` and `commands` feed the wizard's "Copy as CLI" card. For `target_runner=bastion` the commands are `./forge share mount --from <central_ip> --target <bastion_ip>` followed by `ssh <user>@<bastion> <forge> provision vms|create cluster --conf <state>/<cluster>/<cluster>-input.ini`.

### `POST /api/v1/clusters/sync-bastion`

Stages the generated config on a bastion and returns `202`. `404` (with a hint to call `init-config`) when the cluster INI does not exist. Records the `cluster-bastion-sync` audit event. Follow progress on `GET /api/v1/pipeline/{run_id}/stream`.

- `nfs_mount: true` (default): `./forge share mount --from <central_ip> --target <bastion_ip>` mounts the forge-central product shares (`~/nkp-forge`, `~/forge-state`, `~/cacrt`) on the bastion, so it sees the INI.
- `nfs_mount: false`: `ssh ... mkdir -p` followed by `scp <cluster>-input.ini` to the bastion state dir (BatchMode, non-interactive).

```json
{ "cluster_name": "nkp-prod-01", "bastion_ip": "10.0.0.50", "nfs_mount": true }
```

```json
{
  "run_id": "6f1c...", "cluster_name": "nkp-prod-01", "bastion_ip": "10.0.0.50", "status": "queued",
  "steps": ["./forge share mount --from 10.0.0.2 --target 10.0.0.50"]
}
```

### `POST /api/v1/clusters/create` (wizard flow)

When `lab_name` is present the request chains the deployment in one run (`202`, `ClusterCommandResponse` plus `steps`, the ordered step labels). Extra fields: `lab_name`, `target_runner` (`central|bastion`), `bastion_ip`, `nfs_mount` (default `true`), `provision_vms` (default `true`).

- `central`: `./forge provision vms --skip-bastion --conf <input.ini>` then `./forge create cluster --conf <input.ini>`.
- `bastion`: the sync step above, then both commands over SSH on the bastion.

`404` when `init-config` has not generated the INI, `400` for a bastion run without `bastion_ip` or an invalid `cluster_name`. The run stops at the first failing step. The SSE stream marks each step with `==> Step <i>/<n>: <label>`, and starts/ends with the dual `[TIMESTAMP] UTC: ... | Local (PST): ...` header lines; the UI turns the markers into step progress indicators. Records the `cluster-create-dispatched` audit event.

```json
{ "cluster_name": "nkp-prod-01", "lab_name": "amd-lab", "control_plane_nodes": 3, "worker_nodes": 3,
  "hypervisor_type": "proxmox", "target_runner": "bastion", "bastion_ip": "10.0.0.50" }
```

`GET /api/v1/lab/config` additionally returns `nkp_version` (the lab's `NKP_CLI_VERSION`, empty when unset) used as the wizard's default.

## Registry & Secrets Vault API (`/api/v1/secrets`)

Credentials are staged under `FORGE_CACRT_DIR` (default `~/cacrt`) using the CLI's canonical layout: `dockerhub/dockerhub-creds.ini` and `<cluster>/harbor-creds.ini` (chmod 600).

- `GET /api/v1/secrets` — lists staged files: `{"secrets": [{"sec_type": "harbor", "user": "nkpadmin", "path": "...", "cluster": "amd-nkp1", "has_ca": true, "password_masked": "********", "updated_at": "...Z"}]}`. Passwords are never returned.
- `POST /api/v1/secrets/save` (admin) — body `{"sec_type": "dockerhub|harbor", "user": "...", "password": "...", "url": null, "ca_path": null, "cluster": null}`; `cluster` is required for `harbor` (`422` otherwise). Returns the masked `SecretItem`. Audit event `secret-saved` (never includes the password). CLI equivalent: `./forge secret save --type harbor --cluster amd-nkp1 --user nkpadmin --pass ...`.
- `DELETE /api/v1/secrets/{sec_type}?cluster=<name>` (admin) — removes the staged INI; `404` when nothing is staged, `400` for an unknown type or a missing harbor cluster. Audit event `secret-deleted`.

## Timestamps & Timezone Handling (UTC Storage Discipline)

The backend, database/state records and audit events operate **exclusively in UTC**. Every timestamp field in every API response (`timestamp`, `created_at`, `started_at`, `captured_at`, `last_seen`, `last_updated_at`, `last_upgrade_at`, SSE `log` event `timestamp`) is serialized as ISO 8601 UTC with a `Z` suffix and no sub-seconds: `YYYY-MM-DDTHH:MM:SSZ` (e.g. `2026-10-01T01:15:30Z`).

- Pydantic schemas use the shared `UtcDatetime` type (`api/app/timeutil.py`). Inputs with other offsets (e.g. `-07:00`) or naive values (assumed UTC) are normalized to UTC on validation.
- Local-time conversion is a **presentation concern of the web console only** (see the User Guide); the API never returns local-time strings in data fields.
- **Dual-timestamp job headers:** when a pipeline run starts and when it finishes, the SSE stream (`GET /api/v1/pipeline/{run_id}/stream`) emits a `log` event whose line is a human-readable header:

```text
[TIMESTAMP] UTC: 2026-10-01T01:15:30Z | Local (PST): 2026-09-30 18:15:30 PDT
```

  The local part is for operator convenience only. Its zone defaults to `America/Los_Angeles` and can be changed with the `FORGE_DISPLAY_TZ` environment variable (any IANA zone name); it never affects stored data.
- Every SSE `log` event carries a UTC `timestamp` attribute: `{"timestamp": "2026-10-01T01:15:31Z", "line": "...", "stream": "stdout"}`.
- `GET /api/v1/clusters` items include an optional `last_updated_at` (UTC, `null` when unknown).

