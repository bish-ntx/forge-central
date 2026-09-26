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

- `ClusterDeployPage.jsx` is a deployment wizard launcher target.
- It provides the initial shell for upcoming step-by-step NKP create flows.

## Frontend Validation Commands

```bash
cd ~/work/git/forge-central/ui
npm test
npm run build
```
