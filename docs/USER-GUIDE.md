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
    - `/diagnostics`
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
- `ClusterDetailPage.jsx` (`/clusters/:name`)
- `DiagnosticsPage.jsx` (`/diagnostics`)
- `FleetDashboardPage.jsx` (`/fleet`)
- `IpamPage.jsx` (`/ipam`)
- `SettingsPage.jsx` (`/settings`)
- `PathSettingsPage.jsx` (`/settings/paths`)
- `UpgradePage.jsx` (`/settings/upgrade`)

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
- Multi-select batch controls:
  - Row checkboxes (`data-testid="checkbox-vm-{vmid}"`) and a header select-all checkbox (`data-testid="checkbox-select-all-vms"`, selects/deselects all filtered VMs).
  - When one or more VMs are selected, a sticky batch bar (`data-testid="batch-action-bar"`) shows "N VMs selected" with `Start Selected`, `Stop Selected`, `Restart Selected` (`btn-batch-start|stop|restart`), and `Destroy Selected` (`btn-batch-destroy`). These call `POST /api/v1/vms/batch-action`.
  - Selection is cleared and the VM list reloaded after the action completes.
- Batch destroy safety:
  - `Destroy Selected` opens a modal (`data-testid="modal-confirm-batch-destroy"`); type `DESTROY` in `input-confirm-batch-destroy` to enable `btn-confirm-batch-destroy`. `btn-cancel-batch-destroy` aborts.

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
- Nodepool management:
  - **Add Nodepool** (`btn-add-nodepool-{clusterName}`) opens `modal-add-nodepool` with nodepool name, replicas, and hypervisor (Proxmox/AHV); Submit calls `POST /api/v1/clusters/{name}/nodepools`.
- Reset Nodes (2-step safety):
  - **Reset Nodes** (`btn-reset-nodes-{clusterName}`) opens `modal-confirm-reset-nodes`; the confirm button stays disabled until `RESET` is typed, then calls `POST /api/v1/clusters/{name}/reset-nodes`.
- Cluster names in cards and table link to the Cluster Detail page.
- Node prep:
  - **Prep Node over SSH** (`btn-open-prep-node-modal`) opens `modal-prep-node`. Enter the host/IP (`input-prep-node-address`), SSH user (`input-prep-node-user`), node role (`select-prep-node-type`: Worker, Control Plane, GPU Worker, Bastion), target infra (`select-prep-target-type`: VM or Bare Metal) and config file path (`input-prep-node-conf`). Tick **Dry run** (`checkbox-prep-node-dry-run`) to preview only.
  - The **CLI Equivalent** card shows the matching `./forge prep node ...` command as you type.
  - **Prep Node** (`btn-submit-prep-node`) calls `POST /api/v1/nodes/prep`, closes the modal and shows a success banner; **Cancel** (`btn-close-prep-node-modal`) closes it. The run is logged in the audit trail as `node-prep-dispatched`.
  - NFS shares are managed through `POST /api/v1/shares/mount` and `GET /api/v1/shares/status` (see the API Guide); mounts are audited as `share-mount-dispatched`.

## Cluster Detail Page (`/clusters/:name`)

Shows a single cluster (`page-cluster-detail`): name, status badge, Kubernetes version, ready/desired nodes, MetalLB VIP range, a nodes table (control-plane vs worker with status badges), and a nodepools section with **Scale +/-** buttons per pool. Header actions: **Back**, **Add Nodepool**, **Reset Nodes** (type `RESET` to confirm), and **Delete Cluster** (asks for confirmation). If the backend is offline, seed data is shown instead of an error.

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

## Diagnostics & Audit Page (`/diagnostics`)

The Diagnostics page provides a Day-0 operational surface for synthetic support bundle capture and audit history:

- Capture card (`data-testid="card-diagnostics-capture"`):
  - Cluster text input (`data-testid="input-diagnostics-cluster"`).
  - Capture trigger button (`data-testid="btn-capture-diagnostics"`) calling `POST /api/v1/diagnostics/capture`.
- Support bundles table (`data-testid="table-diagnostic-bundles"`):
  - Columns: Bundle Filename, Cluster, Size, Captured At, and Status badge (`data-testid="badge-bundle-status"`).
  - Backed by `GET /api/v1/diagnostics/bundles`.
- Operational audit log table (`data-testid="table-audit-logs"`):
  - Columns: Run ID, Timestamp, Verb, User, Status badge (`data-testid="badge-audit-status"`), and Duration.
  - Backed by `GET /api/v1/audit/logs`.
- Safe fallback behavior:
  - If diagnostics or audit APIs are unavailable, the page renders deterministic local mock rows so operators still have stable visibility.

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

## Command Palette (`⌘K` / `Ctrl+K`)

`ui/src/components/common/CommandPalette.jsx` is mounted in `Layout.jsx`, so it is available on every view.

- **Open:** press `⌘K` (Mac) / `Ctrl+K`, or click the header button (`data-testid="btn-open-command-palette"`).
- **Close:** press `Escape` or click outside the modal.
- **Search:** type to filter by title or category (substring match). `Enter` selects the first result; clicking an item navigates and closes the palette.
- **Items:** navigation (`Go to VMs`, `Go to Clusters`, `Go to Fleet Dashboard`, `Go to Diagnostics`, `Go to IPAM Subnets`, `Go to Settings`, `Path Configuration & Migration`), quick actions (`Deploy NKP Cluster`, `Create Virtual Machine`, `Capture Diagnostics`), and seeded cluster/VM entries.
- **Locators:** `command-palette-modal`, `input-command-palette`, `command-palette-results`, `command-item-{id}`.

## Error Remediation Cards

`ui/src/utils/errorRemediation.js` exports `getRemediation(errorMsgOrCode)`, returning `title`, `description`, `actionable_fix`, `severity` (`critical` | `warning` | `info`) and an optional `cli_command`. Recognized patterns: IPAM exhaustion, SSH connectivity failures, Helm/Kommander timeouts, and disk-full errors; anything else gets a generic fallback.

`ErrorRemediationCard` (`data-testid="card-error-remediation"`, `ui/src/components/common/ErrorRemediationCard.jsx`) renders the result with a copyable CLI command: `<ErrorRemediationCard error={message} />`.

## Multi-Tab State Sync

`ui/src/hooks/useTabSync.js` uses a `BroadcastChannel` named `forge-central-events` (silently disabled where unsupported):

- `broadcastTabEvent(eventType, payload)` notifies other tabs (e.g. `vm_created`, `cluster_deleted`, `cluster_deployed`).
- `useTabSync(eventType, callback)` runs `callback(payload)` when another tab broadcasts that event, typically to refetch data.

## Path Settings & State Directory Migration (`/settings/paths`)

Open via the sidebar (`Path Configuration`, `data-testid="link-settings-paths"`) or the Command Palette (`Path Configuration & Migration`).

- **Path inspection grid:** one card per directory (`FORGE_HOME`, `FORGE_DATA_DIR`, `FORGE_CENTRAL_DATA_DIR`, `FORGE_BACKUP_DIR`, `FORGE_LOG_DIR`; `card-path-{NAME}`) showing the resolved path, a status pill (`accessible`, `read-only`, `missing`) and a disk usage bar. Locations are set with the matching environment variables; they are never hardcoded.
- **State directory migration (`card-path-migration`):** enter a source (`input-migration-source`, default `~/forge-state`) and target (`input-migration-target`, default `~/forge-data`), then press the submit button (`btn-trigger-migration`). Tick **Dry run** (`checkbox-migration-dry-run`) to preview what would be copied without touching disk. Only `*.ini`, `*.yaml`, `*.json` and `*.log` files are copied; the source is left in place.
- **Result banner (`alert-migration-result`):** shows scanned/migrated file counts and the outcome message. Each migration is recorded in the audit trail as `paths-migrated`.

- **State Backup & Archives (`section-backups`):** press **Create Instant Backup** (`btn-create-backup`) before destructive operations (migrations, upgrades, deletions) to export a compressed `.tar.gz` of state, CA certificates (`~/cacrt/`) and the SQLite database into `FORGE_BACKUP_DIR`; `*.log` files are excluded. The table (`table-backups`) lists Filename, Size, Created At and SHA-256 Checksum, newest first, and a CLI snippet shows `./forge backup create`. Each backup is recorded in the audit trail as `backup-created`.
- **Restoring a backup:** press **Restore** (`btn-restore-{backup_id}`) in the Actions column of `table-backups`. The confirmation modal (`modal-confirm-restore`) shows the filename, a SHA-256 verification badge (`badge-restore-checksum`) and a warning that an automatic pre-restore safety snapshot is taken first. Type `RESTORE` (`input-confirm-restore`) to enable **Confirm Restore** (`btn-confirm-restore`); **Cancel** (`btn-close-restore-modal`) closes without changes. On success a banner (`alert-restore-result`) reports the restored file count and safety snapshot ID, and the list refreshes. CLI equivalent: `./forge restore execute --backup <id>`. Each restore is recorded in the audit trail as `state-restored`.

## Access Roles (Viewer / Operator / Admin)

The header role badge (`badge-role-switcher`) shows the current role and opens a menu to switch. The choice is remembered in the browser (`localStorage`).

| Role | Badge | What it can do |
| --- | --- | --- |
| `viewer` | `Demo (Viewer)` | Read-only, safe for customer demos. Every mutating button (deploy, create, power, scale, reset, delete, destroy, capture, migrate, backup, restore) is disabled with the tooltip "Action disabled in Demo/Viewer mode". |
| `operator` (default) | `Operator` | Routine cluster creation, nodepool scaling, VM power actions, reset/delete/destroy with typed confirmation. Day-0 controls on `/settings/paths` (migration, backup, restore) stay disabled with the tooltip "Day-0 infrastructure setup requires Admin role". |
| `admin` | `Admin` | Everything, including Day-0 infrastructure setup. |

**Unlocking Admin:** choose **Admin** in the role menu. The `modal-unlock-admin` dialog asks for the admin passphrase (`input-unlock-admin-passphrase`); the role changes only after the server accepts it. The passphrase is configured with `FORGE_ADMIN_PASSWORD` (default `Nutanix.123`; change it for any shared deployment). A wrong passphrase leaves your current role unchanged.

**Typed confirmations:** destructive actions never run on a single click. The confirm button stays disabled until you type the exact uppercase keyword: `DELETE` for **Delete Cluster** (`modal-confirm-cluster-delete`, also on the cluster detail page), `RESET` for **Reset Nodes** (`modal-confirm-reset-nodes`), and `DESTROY` for **Destroy Selected** VMs (`modal-confirm-batch-destroy`). Lowercase or extra characters do not enable the button.

## Automatic Safety Snapshots on Destructive Operations

Before **Delete Cluster**, **Reset Nodes** (cluster list and detail pages) and **Destroy Selected** (VM batch destroy) run, Forge Central automatically archives its state, CA certificates and database into `FORGE_BACKUP_DIR` as `safety-<operation>-<resource>-<timestamp>-<id>.tar.gz` (with a `.sha256` companion). The confirmation dialogs show a teal notice (`banner-safety-snapshot-notice`) and the API returns the snapshot ID as `safety_backup_id`. If something goes wrong, restore it from Path Settings (`/settings/paths`). Safety snapshots appear in the audit trail as `safety-snapshot-created`.

## Air-Gapped Upgrade (`/settings/upgrade`)

Open via the sidebar (`Upgrade`, `data-testid="link-settings-upgrade"`) or the Command Palette (`Air-Gapped Upgrade`).

- **Current Version card (`card-current-version`):** running version, platform, architecture and last upgrade time.
- **Bundle Inspection card (`card-upgrade-inspect`):** enter the path of a `forge-central-v<VERSION>.tar.gz` release bundle (`input-upgrade-bundle-path`) and press **Inspect Bundle** (`btn-inspect-upgrade`). The pre-flight checklist (`list-upgrade-preflight`) shows a green check or red cross with a message for bundle format, checksum, version compatibility and free disk space.
- **CLI snippet:** shows `./scripts/build-release-bundle.sh` to build a bundle, or `./scripts/install-upgrade.sh --bundle <path>` once all checks pass.

Build bundles with `scripts/build-release-bundle.sh` (see `docs/DEPLOYMENT-GUIDE.md`).

## Copy as CLI Snippet Cards

Create dialogs and review steps show a **CLI Equivalent** card (`card-cli-snippet`) with the `./forge` command matching the current form values, so you can reproduce an action from a terminal.

- **Cluster Deploy (Stage 4):** under the Deployment Configuration Summary.
- **VM list → Create VM modal:** updates as you type the name, node, cores and memory.
- **Clusters → Add Nodepool modal:** updates with the nodepool name and replicas.

Press **Copy** (`btn-copy-cli-snippet`) to copy the command to the clipboard; the button briefly shows **Copied!**.

## Offline Synthetic Mock Mode

Develop, test or demo the whole console without Proxmox or a Kubernetes cluster:

```bash
FORGE_MOCK_MODE=true uvicorn api.app.main:app
```

The header shows an amber **[SYNTHETIC MOCK MODE]** badge (`badge-mock-mode`). The VM list shows 6 sample VMs, Clusters shows `amd-nkp1` (ready) and `cirra-nkp1` (deploying), and every action streams simulated terminal output that finishes successfully.

## Timezone Display (Local vs UTC)

All data is stored and transmitted in UTC (ISO 8601, `...Z`). The console converts it for display:

- **Auto-detect:** your browser timezone is used (`Intl.DateTimeFormat().resolvedOptions().timeZone`); if unavailable it falls back to `America/Los_Angeles` (PST/PDT).
- **Header toggle:** the clock badge in the header (`button-timezone-toggle`) shows the current mode, e.g. `PDT (Local)` or `UTC`. Click it to switch every timestamp in the console between your local zone and UTC.
- **Persistence:** your choice is saved in the browser's `localStorage` (`forge_timezone_mode`) and restored on the next visit.
- **Tooltip:** hover over any timestamp to see the raw UTC value (`UTC: 2026-10-01T01:15:30Z`).
- **Where it applies:** Diagnostics (support bundles, audit trail), Clusters (Last Updated), Path Settings (backup and safety-snapshot tables), Fleet (last sync), Upgrade (last upgrade) and each line of the Live Terminal.
- **Live logs:** pipeline runs begin and end with a dual-timestamp header, e.g. `[TIMESTAMP] UTC: 2026-10-01T01:15:30Z | Local (PST): 2026-09-30 18:15:30 PDT`.

## Frontend Validation Commands

```bash
cd ~/work/git/forge-central/ui
npm test
npm run build
```
