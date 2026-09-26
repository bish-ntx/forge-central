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
