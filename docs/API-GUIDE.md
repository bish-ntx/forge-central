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

Queues cluster deletion for workload or management clusters.

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

Queues `preprov-reset-nodes.sh` for the cluster and records a `cluster-reset-nodes` entry in the audit trail (`GET /api/v1/audit/logs`). Returns `202` with a `ClusterCommandResponse`.

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
