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

The NKP Cluster Deploy page (`ClusterDeployPage.jsx`) is a guided, self-service wizard that generates a real cluster config from your lab and runs the `./forge` deployment pipeline either on Forge Central or on a cluster bastion. Prerequisite: create a lab first (Settings -> Lab Infrastructure, or `./forge init lab`). No mock data is shown: labs, IP slots and the config come from the live API.

1. **Stage 1: Cluster Basics & Lab Inheritance** (`stage-1-container`)
   - Pick the **Lab** (`select-lab`, populated from `GET /api/v1/lab/config`). The **inheritance card** (`lab-inheritance-card`) shows the Proxmox host, network bridge, storage pool and default NKP version that the cluster inherits; switching labs reloads them.
   - Enter the cluster name (`input-cluster-name`), hypervisor (`select-hypervisor`) and NKP version (`input-nkp-version`, defaulted from the lab).
   - **Next** stays disabled (with the reason shown in `text-next-blocker`) until a lab is selected and the name is valid. With no labs, a notice (`lab-empty-notice`) points you to the Day-0 Lab Wizard.
2. **Stage 2: Node Sizing & IPAM Allocation** (`stage-2-container`)
   - Control plane count 1-9 (`input-control-plane-count`), workers 0-64 (`input-worker-count`), storage mode (`select-storage-mode`) and registry type (`select-registry-type`), both pre-filled from the lab.
   - The **IPAM card** (`ipam-preview-card`) fetches the unassigned slots from `GET /api/v1/ipam/free` and previews the suggested **Control Plane VIP** (`text-vip-preview`), **MetalLB range** (`text-metallb-preview`) and free-slot count; **Refresh** (`btn-refresh-ipam`) re-queries.
3. **Stage 3: Deployment Runner Target** (`stage-3-container`)
   - **Option A: Execute on Forge Central** (`radio-runner-central`): `./forge provision vms` and `./forge create cluster` run on this host.
   - **Option B: Stage & Execute on Cluster Bastion** (`radio-runner-bastion`): enter the bastion IP/hostname (`input-bastion-ip`). The list (`bastion-sync-steps`) shows the automated steps: write `<cluster>-input.ini`, `./forge share mount --from <central> --target <bastion>`, then run both commands on the bastion over SSH. Requires passwordless SSH from Forge Central to the bastion.
4. **Stage 4: Config Preview & Copy as CLI** (`stage-4-container`)
   - Entering this stage calls `POST /api/v1/clusters/init-config`: the real `<cluster>-input.ini` is written (inheriting the lab, lab credentials never copied) with the VIP and MetalLB range reserved from free IPAM slots. The file content (`config-preview`) and the **Copy as CLI** card list `./forge init nkp-cluster`, `./forge provision vms` and `./forge create cluster` (or the share-mount and SSH variants for a bastion).
   - Bastion runs also get **Sync to Bastion** (`btn-sync-bastion`) to stage the config ahead of time (`POST /api/v1/clusters/sync-bastion`; the run id appears in `text-sync-run-id`). Launch performs the same sync automatically.
   - **Launch Deployment** (`btn-wizard-launch`) is enabled once the config exists; a failed generation shows the API error with **Retry** (`btn-retry-config`). Viewers cannot generate or launch.
5. **Stage 5: Live Execution & SSE Streaming** (`stage-5-container`)
   - One run streams every step to the terminal (`terminal-live-logs`) with per-line times in your selected timezone; the run start is shown in UTC and local time (`run-started-at`) and the log carries `[TIMESTAMP] UTC: ... | Local (PST): ...` header lines.
   - **Step progress indicators** (`step-progress-1..n`) turn from pending to running to done (or failed) as the `==> Step i/n` markers arrive. The run stops at the first failing step.
- **Navigation:** Back/Next (`btn-wizard-back`, `btn-wizard-next`) keep your entries across stages; Back is disabled once a run has started and Launch cannot be double-submitted.
- **CLI equivalent:** `./forge init nkp-cluster --cluster <name> --lab-infra ~/forge-state/labs/<lab>/<lab>-infra.ini --non-interactive`, then `./forge provision vms --conf <input.ini>` and `./forge create cluster --conf <input.ini>`.

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

## Login Gateway (First Visit)

On first visit (or after **Log Out**) the **Welcome to Forge Central** screen (`modal-login-gateway`) asks how to enter: **Enter as Operator / Viewer** (`btn-gateway-operator`, one click; `btn-gateway-viewer` enters read-only) or **Unlock as Administrator** (`btn-gateway-admin`, then the passphrase in `input-gateway-passphrase`). Tick **Remember my choice on this browser** (`checkbox-gateway-remember`) to keep the role across browser restarts; otherwise it lasts for the current tab only. **Log Out** (`btn-logout-switch-user`, next to the role badge) clears the stored role and shows the gateway again.

## Day-0 Lab Wizard & Secrets Vault (`/settings`)

Both tabs are visible to everyone, but every save/stage/delete button needs the **Admin** role (tooltip: "Day-0 infrastructure setup requires Admin role").

- **Lab Infrastructure** (`tab-lab-infra`): fill in Proxmox host/IP, target node, storage pool, bridge, DNS nameservers, search domain, lab IP pool (e.g. `10.0.0.10-10.0.0.40`), golden VMID and registry type, then press **Save & Initialize Lab** (`btn-save-lab`). This writes `FORGE_HOME/labs/<lab>/<lab>-infra.ini` (chmod 600); an existing lab is loaded into the form and its previous file is kept as `.bak`. Leave the password blank to keep the stored one. The `<lab>-infra.ini` preview (`preview-lab-ini`) masks the password and the **Copy as CLI** card gives the equivalent `./forge init lab --non-interactive ...` command.
- **Registry & Secrets Vault** (`tab-secrets-vault`): **Stage Docker Hub PAT** (`modal-stage-dockerhub`) and **Stage Harbor Registry** (`modal-stage-harbor`, needs a cluster name) save credentials under `~/cacrt` (chmod 600). `table-secrets` lists type, user, file location and status with passwords masked (`********`); the trash icon deletes a staged secret. CLI equivalent: `./forge secret save|list|delete`.

## Automatic Safety Snapshots on Destructive Operations

Before **Delete Cluster**, **Reset Nodes** (cluster list and detail pages) and **Destroy Selected** (VM batch destroy) run, Forge Central automatically archives its state, CA certificates and database into `FORGE_BACKUP_DIR` as `safety-<operation>-<resource>-<timestamp>-<id>.tar.gz` (with a `.sha256` companion). The confirmation dialogs show a teal notice (`banner-safety-snapshot-notice`) and the API returns the snapshot ID as `safety_backup_id`. If something goes wrong, restore it from Path Settings (`/settings/paths`). Safety snapshots appear in the audit trail as `safety-snapshot-created`.

## IPAM Ledger & Subnet Manager (`/ipam`)

Open via the sidebar (`link-ipam`). The page mirrors `./forge ipam list` so you can see which lab IPs are taken without a terminal.

- **KPI cards:** Total IPs (`card-ipam-total`), Allocated IPs (`card-ipam-allocated`) and Free IPs (`card-ipam-free`); the header shows the lab IP pool and when the ledger was last read. **Refresh** (`btn-refresh-ipam`) re-reads it.
- **Search & status filter:** `input-ipam-search` matches IP, cluster, hostname, role or status; `select-ipam-status` narrows to `all`, `allocated`, `free`, `vip` or `gateway`.
- **Ledger table (`table-ipam`):** IP address, status badge (`ALLOCATED`, `FREE`, `VIP`, `GATEWAY`), cluster, hostname / role and VMID.
- **Release Reservation (`btn-release-<cluster>`):** one button per cluster that holds IPs (Operator or Admin; disabled in Viewer mode). A confirmation dialog (`modal-confirm-release`) takes a safety snapshot first and enables **Confirm Release** (`btn-confirm-release`) only after you type `RELEASE` (`input-confirm-release`). The cluster's slots return to the free pool and an `ipam-released` event is added to the audit trail.
- **Reconcile VMIDs (`btn-reconcile-ipam`):** runs the read-only VMID drift check and lists `claimed-but-not-live` (stale reservations) and `live-but-not-claimed` (collision risks) VMIDs, or reports that the ledger is in sync. Nothing is modified.
- **Copy as CLI:** snippet cards for `./forge ipam list` and `./forge ipam free`.

With `FORGE_MOCK_MODE=true` the page shows a synthetic ledger for `10.0.0.10`-`10.0.0.40`.

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
