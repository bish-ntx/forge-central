"""Full-stack hybrid E2E: Web Console wizard -> IPAM -> SSE logs -> Proxmox / kubectl / helm / NKP audit.

ui-only (default / dry-run): Phase 1 against the isolated mock backend, never Launch (< 60 s).
live-proxmox:                Phase 1 + Launch + Phase 2 post-flight probes (see tests/e2e/test-config.ini).
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any, Callable, Dict, List
from urllib.request import Request, urlopen

import pytest
from playwright.sync_api import Page, expect

import live_probes
from test_config import E2EConfig, expand_ip_range, find_ipam_conflicts, load_config

UI_ONLY_BUDGET_SECONDS = 60
UI_DEFAULT_CP, UI_DEFAULT_WORKERS = 3, 4


def _get_json(url: str) -> Any:
    with urlopen(url, timeout=15) as response:  # noqa: S310
        return json.loads(response.read())


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def cfg() -> E2EConfig:
    return load_config()


@pytest.fixture(scope="module")
def deploy_target(cfg: E2EConfig, backend_base_url: str) -> E2EConfig:
    """Seed the lab (ui-only) and abort the whole run when the target conflicts with active IPAM allocations."""
    if not cfg.live:
        payload = {
            "lab_name": cfg.lab_name,
            "pve_host": cfg.pve_host,
            "pve_node": "pve1",
            "storage_pool": cfg.storage_pool,
            "network_bridge": cfg.network_bridge,
            "nameserver": "10.0.0.1",
            "lab_ip_pool": "10.0.0.10-10.0.0.40",
        }
        request = Request(  # noqa: S310
            f"{backend_base_url}/api/v1/lab/init",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json", "X-Forge-Role": "admin"},
            method="POST",
        )
        with urlopen(request, timeout=10) as response:  # noqa: S310
            assert response.status == 200

    conflicts = find_ipam_conflicts(cfg, _get_json(f"{backend_base_url}/api/v1/ipam")["slots"])
    if conflicts:
        pytest.exit("E2E aborted — IPAM conflict: " + "; ".join(conflicts), returncode=2)
    return cfg


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _next(page: Page) -> None:
    page.get_by_test_id("btn-wizard-next").click()


def _eventually(check: Callable[[], Any], timeout: int, interval: int = 10) -> Any:
    """Poll ``check`` (raises AssertionError until satisfied) for up to ``timeout`` seconds."""
    deadline = time.monotonic() + timeout
    while True:
        try:
            return check()
        except AssertionError:
            if time.monotonic() >= deadline:
                raise
            time.sleep(interval)


def _stage1(page: Page, cfg: E2EConfig) -> None:
    expect(page.get_by_test_id("stage-1-container")).to_be_visible()
    page.get_by_test_id("select-lab").select_option(cfg.lab_name)
    expect(page.get_by_test_id("select-lab")).to_have_value(cfg.lab_name)
    # Lab inheritance card mirrors the configured lab.
    expect(page.get_by_test_id("text-lab-pve-host")).to_have_text(cfg.pve_host)
    expect(page.get_by_test_id("text-lab-bridge")).to_have_text(cfg.network_bridge)
    expect(page.get_by_test_id("text-lab-storage-pool")).to_have_text(cfg.storage_pool)
    page.get_by_test_id("input-cluster-name").fill(cfg.cluster_name)
    # Registry credential badge resolves to exactly one of: configured / missing.
    expect(
        page.locator('[data-testid="registry-secret-stage1-ok"], [data-testid="registry-secret-stage1-missing"]')
    ).to_have_count(1)
    _next(page)


def _stage2(page: Page, cfg: E2EConfig, backend_url: str) -> Dict[str, str]:
    expect(page.get_by_test_id("stage-2-container")).to_be_visible()
    cp, workers = page.get_by_test_id("input-control-plane-count"), page.get_by_test_id("input-worker-count")
    expect(cp).to_have_value(str(UI_DEFAULT_CP))
    expect(workers).to_have_value(str(UI_DEFAULT_WORKERS))
    if cfg.control_plane_nodes != UI_DEFAULT_CP:
        cp.fill(str(cfg.control_plane_nodes))
    if cfg.worker_nodes != UI_DEFAULT_WORKERS:
        workers.fill(str(cfg.worker_nodes))

    # VIP + MetalLB are auto-allocated from the free IPAM pool.
    vip_el, metallb_el = page.get_by_test_id("text-vip-preview"), page.get_by_test_id("text-metallb-preview")
    expect(vip_el).to_be_visible()
    vip, metallb = vip_el.inner_text().strip(), metallb_el.inner_text().strip()
    free_ips = {slot["ip"] for slot in _get_json(f"{backend_url}/api/v1/ipam/free")}
    assert vip in free_ips, f"VIP {vip} is not in the free IPAM pool"
    metallb_ips = expand_ip_range(metallb)
    assert metallb_ips and set(metallb_ips) <= free_ips, f"MetalLB range {metallb} is not fully free"
    assert vip not in metallb_ips
    assert int(page.get_by_test_id("text-ipam-free-count").inner_text()) == len(free_ips)

    # Prism PE/PC badges (shown for Nutanix CSI storage modes) render inherited/override state.
    mode_select = page.get_by_test_id("select-storage-mode")
    original_mode = mode_select.input_value()
    if not page.get_by_test_id("prism-accordion").is_visible():
        mode_select.select_option("nutanix-csi-pe")
    expect(page.get_by_test_id("prism-accordion")).to_be_visible()
    for field in ("prism_endpoint", "prism_port", "prism_user", "storage_container"):
        expect(page.get_by_test_id(f"badge-{field}")).to_be_visible()
    mode_select.select_option(original_mode)
    expect(page.get_by_test_id("prism-accordion")).to_have_count(0 if original_mode == "local" else 1)
    _next(page)
    return {"vip": vip, "metallb": metallb}


def _stage3(page: Page) -> None:
    expect(page.get_by_test_id("stage-3-container")).to_be_visible()
    expect(page.get_by_test_id("radio-runner-central")).to_be_checked()
    expect(page.get_by_test_id("bastion-options")).to_have_count(0)
    # Bastion target requires an IP before the wizard can advance; switch back to central afterwards.
    page.get_by_test_id("radio-runner-bastion").check()
    expect(page.get_by_test_id("bastion-options")).to_be_visible()
    expect(page.get_by_test_id("btn-wizard-next")).to_be_disabled()
    expect(page.get_by_test_id("text-next-blocker")).to_contain_text("bastion")
    page.get_by_test_id("radio-runner-central").check()
    expect(page.get_by_test_id("btn-wizard-next")).to_be_enabled()


def _stage4(page: Page, cfg: E2EConfig, ips: Dict[str, str], result: Dict[str, Any]) -> None:
    expect(page.get_by_test_id("stage-4-container")).to_be_visible()
    assert result["config_path"].endswith(f"{cfg.cluster_name}-input.ini")

    preview = page.get_by_test_id("config-preview")
    expect(preview).to_be_visible()
    text = preview.inner_text()
    expected = {
        "CLUSTER_NAME": cfg.cluster_name,
        "CONTROL_PLANE_COUNT": cfg.control_plane_nodes,
        "WORKER_COUNT": cfg.worker_nodes,
        "KUBE_VIP": ips["vip"],
        "METALLB_RANGE": ips["metallb"],
        "PVE_CLUSTER_HOST": cfg.pve_host,
        "STORAGE_POOL": cfg.storage_pool,
        "NETWORK_BRIDGE": cfg.network_bridge,
    }
    for key, value in expected.items():
        assert f'{key}="{value}"' in text, f"{cfg.cluster_name}-input.ini missing {key}={value}"
    assert "PASSWORD" not in text, "credentials must never be copied into the cluster input.ini"
    expect(page.get_by_test_id("text-config-vip")).to_have_text(ips["vip"])
    expect(page.get_by_test_id("text-config-metallb")).to_have_text(ips["metallb"])
    expect(page.get_by_test_id("deploy-summary")).to_contain_text(
        f"{cfg.control_plane_nodes} CP / {cfg.worker_nodes} Workers"
    )


def _stage5_live(page: Page, cfg: E2EConfig) -> None:
    page.get_by_test_id("btn-wizard-launch").click()
    expect(page.get_by_test_id("terminal-live-logs")).to_be_visible()
    expect(page.get_by_test_id("terminal-line-1")).to_be_visible(timeout=30_000)
    status = page.get_by_test_id("terminal-status-label")
    expect(status).to_have_text(re.compile("COMPLETED|FAILED"), timeout=cfg.launch_timeout_seconds * 1000)
    assert status.inner_text().strip() == "COMPLETED", "cluster deployment pipeline FAILED (see LiveTerminal log)"


def _phase2(cfg: E2EConfig, backend_url: str, init_result: Dict[str, Any]) -> None:
    ledger = _get_json(f"{backend_url}/api/v1/ipam")["slots"]
    vmids: List[int] = sorted(s["vmid"] for s in ledger if s.get("cluster") == cfg.cluster_name and s.get("vmid"))
    assert len(vmids) == cfg.total_nodes, f"IPAM ledger lists {len(vmids)} VMIDs, expected {cfg.total_nodes}"

    if cfg.verify_qm_status:  # hypervisor probe
        states = live_probes.probe_qm_running(cfg, vmids)
        assert all(state == "running" for state in states.values()), f"VM power states: {states}"

    kubeconfig = live_probes.resolve_kubeconfig(cfg) if (cfg.verify_kubectl or cfg.verify_helm) else None
    if cfg.verify_kubectl:  # cluster probe
        def _nodes_ready() -> None:
            nodes = live_probes.probe_kubectl_nodes(kubeconfig)
            assert len(nodes) == cfg.total_nodes, f"{len(nodes)} nodes, expected {cfg.total_nodes}"
            assert all(nodes.values()), f"NotReady nodes: {[n for n, ok in nodes.items() if not ok]}"

        _eventually(_nodes_ready, timeout=300)

    if cfg.verify_helm:  # workload probe
        def _charts_deployed() -> None:
            releases = live_probes.probe_helm_releases(kubeconfig)
            for needle in cfg.helm_releases:
                assert any(needle in name.lower() and status == "deployed" for name, status in releases.items()), (
                    f"no deployed helm release matching '{needle}' (found: {sorted(releases)})"
                )

        _eventually(_charts_deployed, timeout=300)

    if cfg.verify_nkp_dashboard:  # dashboard probe
        conf = Path(cfg.forge_conf or init_result["config_path"]).expanduser()
        info = live_probes.probe_nkp_dashboard(live_probes.resolve_forge_bin(cfg), conf if conf.is_file() else None)
        assert info["has_credentials"], "forge get nkp-dashboard printed no credentials/token"
        assert info["http_status"] == 200, f"dashboard {info['url']} answered HTTP {info['http_status']}"


# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------
def test_full_stack_cluster_deploy(page: Page, base_url: str, backend_base_url: str, deploy_target: E2EConfig) -> None:
    cfg = deploy_target
    started = time.monotonic()

    # Phase 1 — Web Console wizard
    page.goto(f"{base_url}/clusters/deploy")
    gateway_btn = page.get_by_test_id("btn-gateway-operator")
    if gateway_btn.is_visible():
        gateway_btn.click()
    expect(page.get_by_test_id("page-clusters-deploy")).to_be_visible()

    _stage1(page, cfg)
    ips = _stage2(page, cfg, backend_base_url)
    _stage3(page)
    with page.expect_response(lambda r: r.url.endswith("/api/v1/clusters/init-config")) as response_info:
        _next(page)
    init_result = response_info.value.json()
    _stage4(page, cfg, ips, init_result)

    if not cfg.live:
        launch = page.get_by_test_id("btn-wizard-launch")
        expect(launch).to_be_visible()
        expect(launch).to_be_enabled()
        expect(page.get_by_test_id("terminal-live-logs")).to_have_count(0)  # never launched in ui-only
        elapsed = time.monotonic() - started
        assert elapsed < UI_ONLY_BUDGET_SECONDS, f"ui-only run took {elapsed:.1f}s (budget {UI_ONLY_BUDGET_SECONDS}s)"
        return

    _stage5_live(page, cfg)
    # Phase 2 — post-flight audit
    _phase2(cfg, backend_base_url, init_result)
