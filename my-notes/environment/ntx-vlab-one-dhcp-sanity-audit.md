# `ntx-vlab-one` DHCP Sanity VM Audit — Task 38

- **Executor:** VS Code + Nutanix NAI
- **Model:** high
- **Timestamp:** 2026-10-03T02:53:15Z
- **Result:** **BLOCKED during read-only preflight; no Compose rebuild or VM mutation was performed**

## Safety gates

| Gate | Result | Evidence |
|---|---|---|
| Forge Central `/health` | PASS | `10.123.238.120:8000` returned HTTP 200 and `status=healthy`. |
| Forge Central `/api/v1/settings/paths` | PASS with warning | Returned HTTP 200; `/forge-state`, `/forge-data`, `/var/log/forge-central` accessible. `FORGE_BACKUP_DIR` was missing. Runtime reported `FORGE_CENTRAL_DATA_DIR=/forge-state`, not the expected `/forge-central-data`. |
| Forge Central `/api/v1/ipam` | **FAIL** | Returned HTTP 500 because configured `/app/forge` was unavailable. |
| Forge Central repository synchronization | **FAIL/INCOMPLETE** | Local `forge-central` was `main`, commit `6c84672aba322d1a347aee1adff0317b8901c518`, ahead of `origin/main` by 1 and had untracked `.vscode/`; local `~/nkp-forge` was absent. Remote application VM user had no `~/forge-central` Git checkout. Synchronization could not be verified. |
| Running container CLI/SSH | **FAIL** | `forge-central` was healthy, but `/nkp-forge/forge` was missing and no `ssh` executable was found. |
| Nested Proxmox reachability | PASS | SSH to `root@10.109.115.50` succeeded; node `bish-proxmox-ve92` online; Proxmox VE `9.2.0`. |
| `vmbr0` | PASS | Bridge was UP with `10.109.115.50/24`. |
| Storage/resource pools | **INCOMPLETE** | `NTX-RESOURCE-POOL` was present. `NTX-STORAGE-POOL` was not confirmed because `pvesm status --output-format json` is unsupported on this host and the returned output did not provide a verified usable pool. |
| VMID `130` collision | PASS | `qm status 130` reported no configuration file. |
| VMID `151` safety | PASS | `qm status 151` reported no configuration file; VMID `151` was not used. |
| VMID `100` | ABSENT | `qm status 100` reported no configuration file. No golden template was used. |
| Approved cloud image | **FAIL** | No usable approved cloud image was found in the inspected host image locations. |
| Forbidden targets | PASS | `10.117.50.111`, `10.123.238.110`, `10.216.60.21`, and `10.216.61.50` were not contacted or inspected. |

## Compose phase

Not executed. Per the stop conditions, the deployment was not stopped, rebuilt, or restarted because repository synchronization was not verified and the runtime remained defective (`/app/forge` and `/nkp-forge/forge` unavailable). No host runtime directories, databases, audit data, telemetry, cluster state, kubeconfigs, secrets, certificates, images, or volumes were deleted or pruned.

Required commands were therefore **not run**:

- `docker compose down`
- `docker compose build --no-cache`
- `docker compose up -d`
- `docker compose ps`

## VM phase

Not executed. VMID `130` was confirmed absent, but no cloud image, verified storage pool, synchronized runtime, or working IPAM API was available. No `qm create`, import, attach, cloud-init, `qm set`, `qm start`, guest-agent polling, or SSH reachability test was performed.

- **VMID `130`:** absent; not created
- **VM status:** none
- **DHCP address:** none assigned
- **Guest-agent result:** not run
- **SSH reachability:** not run
- **Storage/bridge:** `NTX-STORAGE-POOL` not verified; `vmbr0` present but unused
- **Cleanup:** no cleanup required; no VM was created

## Mutation and credential statement

- **Mutations:** none. VMID `130` was not created and cannot be left running.
- VMID `151` was not used or modified.
- No full cluster deployment or lab initialization was run.
- Credentials were read only for metadata/preflight purposes; no passwords, tokens, private-key contents, or credential values were printed, logged, committed, or reported.

## Recovery required

Yes. First synchronize the application and `nkp-forge` repositories on `10.123.238.120`, correct the Compose mounts/runtime so `/nkp-forge/forge` and `ssh` are available and `FORGE_CENTRAL_DATA_DIR` is correct, verify a usable `NTX-STORAGE-POOL`, and stage an approved Ubuntu 24.04 (or approved alternative) cloud image. Then rerun read-only preflight before any mutation.
