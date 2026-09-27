# Forge Central User Guide

## Web Console Launch

Start the frontend locally:

```bash
cd ~/work/git/forge-central/ui
npm install
npm run dev
```

Open the Vite URL shown in terminal (default: `http://127.0.0.1:5173`).

## Layout Overview

The web console uses a dark Tailwind layout inspired by Nutanix/Proxmox operations dashboards:

- **Sidebar (`ui/src/components/layout/Sidebar.jsx`)**
  - Lab site badge: `amd-lab (Santa Clara)`
  - Mode switcher between:
    - `Forge Central Console` (local write mode)
    - `Forge Fleet Dashboard` (HQ read-only mode)
  - Navigation routes:
    - `/vms`
    - `/clusters`
    - `/fleet`
    - `/ipam`
    - `/settings`
- **Header (`ui/src/components/layout/Header.jsx`)**
  - Control-plane mode badge
  - System health status dot
  - Global search trigger bar with `⌘K`
- **Main Panel (`ui/src/components/layout/Layout.jsx`)**
  - Renders route pages through React Router `<Outlet />`

## Route Pages

Current route pages:

- `VmListPage.jsx` (`/vms`)
- `ClustersPage.jsx` (`/clusters`)
- `ClusterDeployPage.jsx` (`/clusters/deploy`)
- `FleetDashboardPage.jsx` (`/fleet`)
- `IpamPage.jsx` (`/ipam`)
- `SettingsPage.jsx` (`/settings`)

Each page container includes a stable `data-testid` to support automated tests and CI flows.

## Fleet Dashboard Page (`/fleet`)

The Fleet Dashboard page is an HQ-level read-only telemetry surface for multi-site visibility:

- Read-only safety indicators:
  - Amber top banner (`data-testid="fleet-banner-readonly"`).
  - Mode badge (`data-testid="fleet-readonly-badge"`) showing `HQ READ-ONLY MODE`.
- Fleet refresh:
  - Manual reload button (`data-testid="btn-refresh-fleet"`) calling `GET /api/v1/fleet/status`.
- Summary metrics row:
  - Total sites (`data-testid="metric-total-sites"`).
  - Total clusters (`data-testid="metric-total-clusters"`).
  - Total VMs (`data-testid="metric-total-vms"`).
  - Total GPU nodes (`data-testid="metric-total-gpu"`).
- Site telemetry cards:
  - `AMD Lab` (`data-testid="site-card-amd-lab"`).
  - `Cirrascale Lab` (`data-testid="site-card-cirra-lab"`).
  - `Nutanix Durham Lab` (`data-testid="site-card-ntx-lab"`).
  - Each card includes status badge (`data-testid="site-status-{site_id}"`), location, cluster/VM/GPU counts, IPAM utilization bar, and last sync timestamp.
- Fallback behavior:
  - If HQ cannot reach the fleet API, the page shows deterministic seed telemetry cards while staying read-only.

## VM Management Page (`/vms`)

The VM page now provides interactive Proxmox/AHV VM operations:

- Search/filter toolbar:
  - Search input (`data-testid="input-vm-search"`) for VM name/VMID matching.
  - Status dropdown (`data-testid="select-vm-status-filter"`) with `All`, `Running`, and `Stopped`.
  - Node dropdown for per-node filtering.
- VM table columns:
  - `VMID`, `Name`, `Node`, `CPUs`, `RAM`, `Disk`, `Status`, `GPU Passthrough`, and `Actions`.
  - Running VMs are shown with a green status badge; stopped VMs use a gray badge.
  - GPU passthrough column marks VMs with attached PCI/GPU devices.
- Lifecycle actions:
  - Start button: `data-testid="btn-vm-start-{vmid}"`.
  - Stop button: `data-testid="btn-vm-stop-{vmid}"`.
  - Destroy button: `data-testid="btn-vm-destroy-{vmid}"`.
- VM creation:
  - Create modal trigger: `data-testid="btn-open-create-vm-modal"`.
  - Modal includes name, node, CPU, RAM, and disk fields and calls `POST /api/v1/vms/create`.
- Destroy safety:
  - Typed-confirmation modal (`data-testid="modal-confirm-vm-destroy"`).
  - User must type VM name exactly before destroy action is enabled.

## NKP Cluster Management Page (`/clusters`)

The Clusters page provides an NKP-focused cluster overview and lifecycle controls:

- Search/filter:
  - Search input (`data-testid="input-cluster-search"`) filters by cluster name or Kubernetes version.
- Deployment launcher:
  - Primary button (`data-testid="btn-open-deploy-cluster"`) navigates to `/clusters/deploy`.
- Cluster cards:
  - Each card uses `data-testid="cluster-card-{clusterName}"`.
  - Status badge supports `Ready`, `Deploying`, and `Failed` states.
  - Node readiness progress displays `Ready N/M nodes` with a progress bar.
  - MetalLB VIP range is displayed per cluster.
- Cluster table:
  - Tabular summary (`data-testid="table-clusters"`) mirrors card data for quick scanning.
- Safe destructive action:
  - Delete button (`data-testid="btn-cluster-delete-{clusterName}"`) opens a typed confirmation modal.
  - Modal (`data-testid="modal-confirm-cluster-delete"`) requires exact cluster name match before delete is enabled.

## NKP Cluster Deploy Page (`/clusters/deploy`)

The NKP Cluster Deploy page (`ClusterDeployPage.jsx`) provides an interactive 5-stage wizard for configuring and launching preprovisioned Nutanix Kubernetes Platform (NKP) clusters:

- **Stage 1: Cluster Basics**
  - Inputs: Cluster name (`data-testid="input-cluster-name"`), hypervisor engine (`data-testid="select-hypervisor"` with Proxmox VE / Nutanix AHV choices), and Kubernetes release version (`data-testid="input-k8s-version"`).
- **Stage 2: Node Topology & Preprovisioned Inventory**
  - Inputs: Control plane node count (`data-testid="input-control-plane-count"`), worker node count (`data-testid="input-worker-count"`), and inventory file selector (`data-testid="select-inventory-file"`).
  - Pre-flight PreprovisionedInventory inspection card (`data-testid="inventory-inspection-card"`):
    - Live pre-flight node status check matrix (`data-testid="preflight-status-checks"`) showing node reachability, role assignments, and hardware capacity.
    - PreprovisionedInventory YAML manifest preview (`data-testid="inventory-yaml-preview"`).
- **Stage 3: Networking & VIP Configuration**
  - Inputs: MetalLB Layer-2 IP range (`data-testid="input-metallb-range"`) and Control Plane API Virtual IP (`data-testid="input-cp-vip"`).
- **Stage 4: Storage & Management Addons**
  - Toggles: Nutanix CSI Storage Driver (`data-testid="toggle-csi"`) and Kommander Addons (`data-testid="toggle-kommander"`).
  - Pre-launch deployment summary box summarizing full cluster specifications.
- **Stage 5: Live Execution & SSE Streaming**
  - Launches `POST /api/v1/clusters/create` on trigger button click (`data-testid="btn-wizard-launch"`).
  - Embedded `<LiveTerminal />` (`data-testid="terminal-live-logs"`) streams real-time execution logs from `/api/v1/pipeline/{run_id}/stream`.
  - Stage status cards (`01-konvoy`, `02-metallb`, `03-csi`, `04-kommander`, `05-validation`) display real-time execution progress.
- **Navigation Controls:**
  - Forward/backward navigation (`data-testid="btn-wizard-next"`, `data-testid="btn-wizard-back"`) with client-side form state retention across step transitions.
  - Launch button debouncing (`disabled={isSubmitting}`) preventing accidental duplicate cluster creation requests.

## Preprovisioned Inventory Inspection & YAML Viewer Component

The `InventoryYamlViewer` component (`ui/src/components/cluster/InventoryYamlViewer.jsx`) provides dedicated YAML manifest inspection and pre-flight health status display:

- **Raw YAML Code Viewer Box (`data-testid="inventory-yaml-text"`):**
  - Dark syntax-highlighted code container with monospace font and custom scrollbar for preprovisioned inventory manifests.
- **Copy Manifest Button (`data-testid="btn-copy-yaml"`):**
  - Instant copy-to-clipboard trigger with visual feedback (`Copied!`).
- **Node Summary Chips:**
  - Control Plane node count & address list chip (`data-testid="chip-cp-nodes"`).
  - Worker node count & address list chip (`data-testid="chip-worker-nodes"`).
- **Validation Check Result Badges (`data-testid="validation-status-badge"`):**
  - Displays pre-flight diagnostic status badges wrapping `POST /api/v1/inventory/validate` / `preprov-diagnose.sh` results.
  - Visual status color indicators for `PASS` (emerald), `WARN` (amber), and `FAIL` (rose) status checks.

## Frontend Validation Commands

```bash
cd ~/work/git/forge-central/ui
npm test
npm run build
```
