"""Browser-free unit tests for the full-stack E2E harness (config loading, IPAM guard, probe parsers)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

import live_probes
from test_config import expand_ip_range, find_ipam_conflicts, load_config


def _ini(tmp_path: Path, body: str) -> Path:
    path = tmp_path / "custom.ini"
    path.write_text(body)
    return path


def test_default_config_is_ui_only_with_3_cp_4_workers() -> None:
    cfg = load_config(environ={})
    assert (cfg.mode, cfg.control_plane_nodes, cfg.worker_nodes, cfg.total_nodes) == ("ui-only", 3, 4, 7)
    assert cfg.live is False and cfg.verify_helm is True


def test_ini_is_customizable_and_env_overrides_it(tmp_path: Path) -> None:
    path = _ini(tmp_path, "[cluster]\ncluster_name = lab-x\nworker_nodes = 2\n[execution]\nmode = dry-run\nverify_helm = no\n")
    cfg = load_config(path, environ={})
    assert (cfg.cluster_name, cfg.worker_nodes, cfg.mode, cfg.verify_helm) == ("lab-x", 2, "ui-only", False)
    assert load_config(path, environ={"FORGE_E2E_CLUSTER_NAME": "from-env"}).cluster_name == "from-env"


def test_live_mode_requires_backend_url(tmp_path: Path) -> None:
    path = _ini(tmp_path, "[execution]\nmode = live-proxmox\n")
    with pytest.raises(ValueError, match="backend_url"):
        load_config(path, environ={})
    assert load_config(path, environ={"FORGE_E2E_BACKEND_URL": "http://h:8000/"}).backend_url == "http://h:8000"


def test_invalid_mode_rejected() -> None:
    with pytest.raises(ValueError, match="mode must be"):
        load_config(environ={"FORGE_E2E_MODE": "prod"})


def test_ipam_guard_flags_cluster_and_ip_conflicts() -> None:
    slots = [
        {"ip": "10.0.0.11", "status": "vip", "cluster": "taken"},
        {"ip": "10.0.0.12", "status": "allocated", "cluster": "taken"},
        {"ip": "10.0.0.20", "status": "free"},
    ]
    clean = load_config(environ={"FORGE_E2E_CLUSTER_NAME": "fresh"})
    assert find_ipam_conflicts(clean, slots) == []
    assert find_ipam_conflicts(load_config(environ={"FORGE_E2E_CLUSTER_NAME": "taken"}), slots)
    ip_clash = load_config(environ={"FORGE_E2E_CONTROL_PLANE_VIP": "10.0.0.11", "FORGE_E2E_METALLB_RANGE": "10.0.0.20-10.0.0.22"})
    assert len(find_ipam_conflicts(ip_clash, slots)) == 1
    assert expand_ip_range("10.0.0.254-10.0.1.1") == ["10.0.0.254", "10.0.0.255", "10.0.1.0", "10.0.1.1"]


def test_probe_parsers() -> None:
    assert live_probes.parse_qm_status("status: running\n") == "running"
    assert live_probes.parse_qm_status("") == ""
    nodes = live_probes.parse_nodes_ready("cp-1 Ready control-plane 1d v1.31\nwk-1 NotReady <none> 1d v1.31\n")
    assert nodes == {"cp-1": True, "wk-1": False}
    releases = live_probes.parse_helm_releases(json.dumps([{"name": "metallb", "status": "deployed"}]))
    assert releases == {"metallb": "deployed"}
    info = live_probes.parse_dashboard("Dashboard: https://10.0.0.30/dkp/kommander/dashboard\nPassword: hunter2\n")
    assert info == {"url": "https://10.0.0.30/dkp/kommander/dashboard", "has_credentials": True}
    assert "hunter2" not in str(info)
