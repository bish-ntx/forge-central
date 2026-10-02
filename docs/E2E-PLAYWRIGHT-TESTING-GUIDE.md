# Full-Stack Hybrid Playwright E2E Testing Guide

The hybrid suite drives the **cluster deployment lifecycle** end to end: Web Console wizard → live IPAM allocation → SSE log
streaming → (optionally) hypervisor, Kubernetes and NKP audits. Files:

| File | Purpose |
| :--- | :--- |
| `tests/e2e/test-config.ini` | All tunables (lab, cluster sizing, mode, verification toggles). Edit without touching code. |
| `tests/e2e/test_config.py` | Config loader (env > ini > default) + IPAM safety guard. |
| `tests/e2e/test_full_stack_cluster_deploy.py` | The Playwright test (Phase 1 wizard, Phase 2 post-flight). |
| `tests/e2e/live_probes.py` | `qm` / `kubectl` / `helm` / `forge get nkp-dashboard` probes + pure output parsers. |
| `tests/e2e/test_e2e_harness_unit.py` | Browser-free unit tests for the config, guard and parsers. |
| `scripts/run-e2e-suite.sh` | Headless runner producing the HTML report, traces and screenshots. |

## Quick start

```bash
python3 -m pip install -r api/requirements.txt -r tests/e2e/requirements-e2e.txt
python3 -m playwright install chromium     # run natively (arm64 on Apple Silicon)
(cd ui && npm ci)

./scripts/run-e2e-suite.sh --mode ui-only
./scripts/run-e2e-suite.sh --mode live-proxmox --conf tests/e2e/test-config.ini
```

Outputs land in `tests/e2e/reports/` (git-ignored): `report.html` (self-contained), `run.log`, and `artifacts/`
(`trace.zip` + `test-failed-*.png` for failures; open traces with `python -m playwright show-trace <trace.zip>`).
The script exits with pytest's status. Extra pytest args can follow `--` (e.g. `-- -k full_stack`).

## Configuration

Resolution per key: **`FORGE_E2E_<KEY>` env var > `test-config.ini` > built-in default** (blank ini values fall through).
`--conf` sets `FORGE_E2E_CONF`; `--mode` sets `FORGE_E2E_MODE`.

| Section | Keys |
| :--- | :--- |
| `[lab]` | `lab_name`, `pve_host`, `storage_pool`, `network_bridge` |
| `[cluster]` | `cluster_name`, `control_plane_nodes` (3), `worker_nodes` (4), `control_plane_vip`, `metallb_range` |
| `[execution]` | `mode` (`ui-only`/`dry-run`/`live-proxmox`), `verify_qm_status`, `verify_kubectl`, `verify_helm`, `verify_nkp_dashboard` |
| `[execution]` (live only) | `backend_url`, `pve_ssh_user`, `kubeconfig`, `forge_bin`, `forge_conf`, `helm_releases`, `launch_timeout_seconds` |

Never put passwords in the ini file; Proxmox access is key-based SSH and the dashboard credentials are only checked for
presence (never logged).

### IPAM safety guard

Before any browser work the suite reads `GET /api/v1/ipam` and **aborts the whole run** (`pytest.exit`, exit code 2) if the
target `cluster_name` already holds an active slot, or if a configured `control_plane_vip` / `metallb_range` overlaps an
allocated slot. Leave the VIP/MetalLB keys blank to let the wizard auto-allocate from the free pool.

## ui-only (regression, < 60 s)

Starts an isolated mock backend (`FORGE_MOCK_MODE=true`, temp state dirs — never touches `~/forge*`) and the Vite dev server,
seeds the lab from `[lab]`, then walks the wizard at `/clusters/deploy`. It never presses **Launch**.

1. **Stage 1** – select lab; inheritance card matches Proxmox host / bridge / storage pool; registry credential badge resolves.
2. **Stage 2** – defaults are 3 CP + 4 workers; VIP and MetalLB preview come from `GET /api/v1/ipam/free` (VIP free, range fully
   free and disjoint); Prism endpoint/port/user/container badges render for Nutanix CSI modes.
3. **Stage 3** – central runner default; bastion requires an IP (Next disabled) and is then switched back.
4. **Stage 4** – `<cluster>-input.ini` preview contains the sizing, VIP, MetalLB, Proxmox values and no passwords; summary and
   Launch button are present.

## live-proxmox (full-stack validation)

Runs against a **real** Forge Central instance (`backend_url`, no mock mode) with a lab already configured. The Vite dev server
proxies to it. After Stages 1–4 the test clicks **Launch**, follows the real SSE stream in `<LiveTerminal />` until `COMPLETED`
(fails on `FAILED`), then runs Phase 2 (each probe is toggleable):

| Probe | Command | Assertion |
| :--- | :--- | :--- |
| Hypervisor (`verify_qm_status`) | `ssh <pve_ssh_user>@<pve_host> qm status <vmid>` for every VMID the IPAM ledger lists for the cluster | exactly `cp+workers` VMs (7) all `status: running` |
| Cluster (`verify_kubectl`) | `kubectl --kubeconfig <conf> get nodes` (polled ≤ 5 min) | 7 nodes, all `Ready` |
| Workloads (`verify_helm`) | `helm list -A -o json` (polled ≤ 5 min) | a `deployed` release matching each `helm_releases` entry (CSI, MetalLB, Kommander) |
| Dashboard (`verify_nkp_dashboard`) | `./forge get nkp-dashboard --conf <input.ini>` | URL printed, credentials/token present, `GET url` → HTTP 200 |

Prerequisites on the machine running the suite: key-based SSH to the Proxmox host, `kubectl`, `helm`, the `./forge` CLI
(`forge_bin` / `$FORGE_BIN`, default `../nkp-forge/forge`), and read access to the kubeconfig (`~/nkp/*/<cluster>.conf` unless
`kubeconfig` is set) and the generated `<cluster>-input.ini` (`forge_conf`, default the path returned by the wizard — set it
when Forge Central runs in a container and the path is not visible on the host).

> Live mode provisions real VMs. Use a dedicated `cluster_name`; remove it afterwards with the Forge Central teardown flow
> (`forge delete cluster` / IPAM release).

## CI

`ui-only` is safe for CI (`.github/workflows/ui-e2e-ci.yml` already runs `tests/e2e/`). Never enable `live-proxmox` in shared CI.
