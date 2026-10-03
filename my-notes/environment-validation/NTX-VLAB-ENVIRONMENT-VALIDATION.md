# NTX VLAB Environment Validation — Task 39

- **Timestamp:** 2026-10-03 (local execution date)
- **Executor/model:** C2-P39, VS Code + Nutanix NAI, high
- **Scope:** Environment validation only; no application source, tests, or tracked configuration changed.
- **Result:** **BLOCKED during preserved-state preflight**

## Source and deployed commits

- Local `forge-central`: `af3a8caf11f10b07007ede8dcc41524e0d4b433d`
- Local `nkp-forge`: `ece300e7a25636464a55c56b0d62f5df135cb482`
- Remote source directories were synchronized without Git metadata, so remote Git commit verification was not available. Required files were present at `~/forge-central/` and `~/nkp-forge/`, including executable `~/nkp-forge/forge` and bootstrap/cloud-init source files.

## Runtime repair

- Preflight `/health`: PASS; healthy, `forge_bin=/app/forge`, `mock_mode=false`.
- `/api/v1/settings/paths`: PASS with warning; `/forge-state` and `/forge-data` were accessible, `/forge-central-data` was reported as the runtime mapping, and `FORGE_BACKUP_DIR` was missing.
- `/api/v1/ipam`: FAIL, HTTP 500, still reporting the prior `/app/forge` runtime problem.
- Container before attempted repair: `forge-central`, healthy, running for approximately 33 hours.
- Host preservation gate: **FAIL** because `/home/nkpadmin/forge-central-data` was absent. `/home/nkpadmin/forge-state`, `/home/nkpadmin/forge-data`, and `/home/nkpadmin/cacrt` were present.
- Compose rebuild: **NOT RUN**. `docker compose down`, `docker compose build --no-cache`, and `docker compose up -d` were not attempted because the required preserved host path check failed.
- Post-block container remained healthy and running; no container stop, rebuild, restart, deletion, prune, or state mutation was performed.
- Container CLI/SSH checks were not treated as repair validation; the existing container inspection did not establish the required repaired runtime state.

## Proxmox discovery

- Target: `10.109.115.50`, node `bish-proxmox-ve92`, online.
- `vmbr0`: UP.
- Storage: `NTX-STORAGE-POOL` available as ZFS storage with `images,rootdir`; `local` and `local-lvm` also discovered.
- Resource pool: `NTX-RESOURCE-POOL` present.
- VMID 130: absent at preflight and post-block read-only diagnostic.
- VMID 100 and VMID 151: not used or modified.
- No approved Ubuntu cloud image was verified because runtime repair was blocked before VM phase.

## VMID 130 / DHCP / guest agent / SSH

- VMID 130 creation: **NOT ATTEMPTED**.
- VMID 130 status: absent; no VM was created and nothing is running under VMID 130.
- DHCP address: none.
- QEMU guest agent: not applicable; no VM created.
- SSH reachability: not applicable; no VM created.
- No retry, deletion, reset, `qm create`, `qm set`, `qm start`, guest-agent polling, or SSH VM test was run.

## Cleanup, blockers, and recovery

- Cleanup: none required; no VM or runtime mutation occurred.
- Primary blocker: required `/home/nkpadmin/forge-central-data` preservation path was missing, so the controlled Compose repair could not safely begin.
- Secondary observed blocker: `/api/v1/ipam` remained HTTP 500 with the prior `/app/forge` issue.
- Recovery: create or restore the intended preserved host data mapping through the approved operator procedure (without deleting existing state), then rerun the read-only mount/state gate, rebuild Compose, validate executable CLI, SSH staging, IPAM, and only then attempt VMID 130 once all Proxmox/image gates pass.

## Safety statements

- Forbidden targets `10.117.50.111`, `10.123.238.110`, `10.216.60.21`, and `10.216.61.50` were not contacted or inspected.
- VMID 151 was not used or modified.
- VMID 100 was not used or modified.
- Static IPAM range `10.109.115.51-10.109.115.56` was not reserved.
- No passwords, tokens, private keys, credential values, or secret contents were printed, logged, committed, or reported.
- No application code, tests, or tracked configuration were changed.

## Task 39B — Repair VLAB Runtime and Validate DHCP Sanity VM 130 (2026-10-03)

- **Executor/model:** C2-P39B, VS Code + Nutanix NAI, high
- **Result:** **SUCCESS**
- **Source commits:** `forge-central` `74be1c876bf7b66533b10fc8b76135f670a74566`; `nkp-forge` `ece300e7a25636464a55c56b0d62f5df135cb482`.
- **Remote repositories:** synchronized source trees present at `~/forge-central` and `~/nkp-forge`; Git metadata was intentionally excluded. Required Compose, entrypoint, executable `nkp-forge/forge`, and bootstrap/cloud-init source files were present.

### Runtime repair

- Created only `/home/nkpadmin/forge-central-data`; verified ownership `uid=1000,gid=1001` and mode `2775`.
- Preserved existing `/home/nkpadmin/forge-state`, `/home/nkpadmin/forge-data`, and `/home/nkpadmin/cacrt`.
- Compose **was rebuilt** with `docker compose down`, `docker compose build --no-cache`, `docker compose up -d`, and `docker compose ps`.
- Container `forge-central`: running and healthy.
- `FORGE_BIN=/nkp-forge/forge`; executable CLI and `/nkp-forge/forge` mount verified.
- SSH client `/usr/bin/ssh` verified; staged key files present with safe permissions; contents were not printed.
- `/health`: HTTP 200, healthy, non-mock mode.
- `/api/v1/settings/paths`: HTTP 200; `/forge-central-data` accessible and writable.
- `/api/v1/ipam`: HTTP 200; no prior CLI-unavailable error.

### Proxmox and VM validation

- Nested node `bish-proxmox-ve92`: online; `vmbr0`: UP.
- `NTX-STORAGE-POOL`: present, ZFS, supports `images`; `NTX-RESOURCE-POOL`: present.
- VMID 130, 151, and 100 were absent before creation. VMID 151 and 100 were not used or modified.
- Approved Ubuntu 24.04 cloud image was obtained through the existing repository bootstrap convention from the approved Ubuntu cloud-image source.
- Exactly one scratch VM was created using the existing bootstrap/cloud-init workflow:
  - VMID `130`
  - Name `ntx-vlab-dhcp-sanity-130`
  - `NTX-STORAGE-POOL`, `vmbr0`, DHCP, 2 vCPU, 2 GiB RAM, 20 GiB disk
  - QEMU guest agent enabled, existing `nkpadmin` SSH/public-key conventions used
- `qm status 130`: **running**.
- `qm agent 130 ping`: **PASS**.
- `qm guest cmd 130 network-get-interfaces`: **PASS**; DHCP address `10.109.115.10`.
- SSH using the approved existing orchestration key: **PASS**; hostname `ntx-vlab-dhcp-sanity-130`, SSH service active.
- VMID 130 remains running for inspection.

### Cleanup, blockers, and safety

- Cleanup required: none; VMID 130 intentionally remains running.
- Recovery required: **NO**. No full lab initialization or cluster deployment was run.
- The static range `10.109.115.51-10.109.115.56` was not reserved.
- Forbidden targets `10.117.50.111`, `10.123.238.110`, `10.216.60.21`, and `10.216.61.50` were not contacted or inspected.
- No passwords, tokens, private-key contents, or credential values were printed, logged, committed, or reported.
- No application source code, tests, or tracked configuration were changed.
