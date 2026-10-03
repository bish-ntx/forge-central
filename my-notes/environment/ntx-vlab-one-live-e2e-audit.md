# `ntx-vlab-one` Live E2E Audit — Task 37

- **Executor:** VS Code + Nutanix NAI
- **Model:** high
- **Timestamp:** 2026-10-03T02:26:57Z
- **Branch:** `main`
- **Commit:** `8471eb9bdaa6c5b3f57390fc102f17a112bf6abc`
- **Result:** **BLOCKED during read-only preflight; live E2E was not executed**

## Preflight results

| Gate | Result | Evidence |
|---|---|---|
| Repository instructions and Prompt-35 harness read | PASS | `AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`, latest audit, and `tests/e2e/*` reviewed. |
| Forge Central `/health` | PASS | `10.123.238.120:8000` reported healthy, `mock_mode=false`. |
| Forge Central `/api/v1/settings/paths` | PASS with warning | Runtime paths accessible; `FORGE_BACKUP_DIR` was missing. |
| Forge Central `/api/v1/ipam` | **FAIL** | API returned HTTP 500: configured runtime forge binary `/app/forge` was unavailable. |
| Forge Central VM Docker/Compose | PASS with limitations | VM `ntx-forge-central1` reachable as `nkpadmin`; `forge-central` container healthy and port `8000` published. The expected source repository path was not present for that user, so repository status/commit could not be inspected remotely. |
| Forge CLI in application runtime | **FAIL** | Container inspection showed no `/nkp-forge/forge`; `ssh` was also unavailable in the container. |
| SSH capability to nested PVE | PASS from operator workstation | Key-based BatchMode SSH to `root@10.109.115.50` succeeded. No key contents were accessed or reported. |
| Nested PVE identity/version | PASS | Proxmox VE `9.2.0`, pve-manager `9.2.2`, host `bish-proxmox-ve92`. |
| Nested PVE `vmbr0` | PASS | `UP`, address `10.109.115.50/24`, bridge member `nic0`. |
| Nested PVE storage/resource pools | PASS | Storage `NTX-STORAGE-POOL` (ZFS) and resource pool `NTX-RESOURCE-POOL` present; additional local pools present. |
| Template VMID 100 | **FAIL** | `qm config 100` reported no configuration file. No template named `ubuntu-2404-golden` was verified. |
| Nested PVE VM inventory/capacity | **FAIL/INCOMPLETE** | VM inventory was empty. Node status/storage capacity queries using the supplied node identifier returned a Proxmox proxy-loop error, so capacity could not be certified. |
| VMID 151 collision guard | PASS | `qm status 151` reported no configuration file on nested PVE. It was not used. |
| IPAM name/address/capacity gate | **FAIL** | IPAM ledger could not be read because the live Forge Central runtime could not invoke `/app/forge`; therefore the cluster name, every proposed address, and sufficient capacity could not be verified. |
| `nkp-forge` conventions | PARTIAL | Local `../nkp-forge/forge` was found executable and inspected read-only. The live API/runtime could not use its configured `/app/forge`, and no live lab config was generated. |

## Capacity decision

**Capacity gate failed.** The supplied pool contains six addresses (`10.109.115.51`–`10.109.115.56`). The existing Prompt-35 workflow requires one free control-plane VIP plus a five-address MetalLB block, in addition to the seven node addresses for the 3-control-plane/4-worker topology. Therefore, even before confirming any bastion/VIP implementation details, the workflow requires at least **13 distinct addresses** when node addresses, VIP, and MetalLB addresses are disjoint (`7 + 1 + 5`), versus **6 available**. The current harness also asserts seven VMIDs/nodes in Phase 2. No address was allocated.

## Configuration and execution

- **Selected cluster name:** none; no unique name was selected because IPAM could not be read.
- **Allocated addresses:** none.
- **Live configuration file:** not created; preflight did not pass.
- **Exact live command:** **not executed**: `./scripts/run-e2e-suite.sh --mode live-proxmox --conf my-notes/environment/ntx-vlab-one-live-e2e.ini`
- **Proxmox result:** preflight only; no workload VMs created.
- **Kubernetes result:** not run.
- **Helm result:** not run.
- **NKP dashboard result:** not run.
- **Created VM identifiers:** none.
- **Created cluster identifier:** none.
- **Cleanup status:** no cleanup required; no mutation occurred.

## Safety and mutation statement

- No infrastructure mutation commands were run. No `qm create`, `qm clone`, `qm set`, `qm start`, `qm stop`, `qm destroy`, cluster creation, IPAM allocation, or live E2E command was run.
- VMID `151` was not created, modified, started, stopped, deleted, or reused on `10.109.115.50`.
- The forbidden targets `10.117.50.111`, `10.123.238.110`, `10.216.60.21`, and `10.216.61.50` were not connected to or inspected.
- No credentials, passwords, tokens, private keys, or private-key contents were printed, copied, committed, or included in this report.

## Recommended recovery

1. Repair/synchronize the Forge Central deployment so the configured `/app/forge` exists and is executable in the running application runtime; then re-run only the read-only API/IPAM checks.
2. Ensure the nested PVE has the required template VMID `100` (`ubuntu-2404-golden`) and that read-only node capacity queries work using the actual node name.
3. Provide a verified IPAM design with at least 13 non-conflicting addresses for the existing 3 CP / 4 worker workflow, or obtain an explicitly supported topology/workflow whose address requirements fit the pool. Do not expand or allocate automatically.
4. Re-run Task 37 from a clean preflight. Do not retry the live workload automatically from this run.
