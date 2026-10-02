"""Parameterized settings for the full-stack hybrid E2E suite.

Resolution order per key: ``FORGE_E2E_<KEY>`` environment variable > ``test-config.ini`` > default.
The ini file is chosen with ``FORGE_E2E_CONF`` (default: ``tests/e2e/test-config.ini``).
"""

from __future__ import annotations

import configparser
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

E2E_DIR = Path(__file__).resolve().parent
DEFAULT_CONF = E2E_DIR / "test-config.ini"
UI_ONLY_MODES = {"ui-only", "dry-run"}
LIVE_MODE = "live-proxmox"
_TRUE = {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class E2EConfig:
    lab_name: str
    pve_host: str
    storage_pool: str
    network_bridge: str
    cluster_name: str
    control_plane_nodes: int
    worker_nodes: int
    control_plane_vip: str
    metallb_range: str
    mode: str
    verify_qm_status: bool
    verify_kubectl: bool
    verify_helm: bool
    verify_nkp_dashboard: bool
    backend_url: str
    pve_ssh_user: str
    kubeconfig: str
    forge_bin: str
    forge_conf: str
    helm_releases: List[str]
    launch_timeout_seconds: int

    @property
    def live(self) -> bool:
        return self.mode == LIVE_MODE

    @property
    def total_nodes(self) -> int:
        return self.control_plane_nodes + self.worker_nodes


# key -> (section, default)
_SPEC: Dict[str, tuple] = {
    "lab_name": ("lab", "e2e-lab"),
    "pve_host": ("lab", "10.0.0.5"),
    "storage_pool": ("lab", "local-lvm"),
    "network_bridge": ("lab", "vmbr0"),
    "cluster_name": ("cluster", "e2e-nkp-01"),
    "control_plane_nodes": ("cluster", "3"),
    "worker_nodes": ("cluster", "4"),
    "control_plane_vip": ("cluster", ""),
    "metallb_range": ("cluster", ""),
    "mode": ("execution", "ui-only"),
    "verify_qm_status": ("execution", "true"),
    "verify_kubectl": ("execution", "true"),
    "verify_helm": ("execution", "true"),
    "verify_nkp_dashboard": ("execution", "true"),
    "backend_url": ("execution", ""),
    "pve_ssh_user": ("execution", "root"),
    "kubeconfig": ("execution", ""),
    "forge_bin": ("execution", ""),
    "forge_conf": ("execution", ""),
    "helm_releases": ("execution", "csi,metallb,kommander"),
    "launch_timeout_seconds": ("execution", "5400"),
}


def _truthy(value: str) -> bool:
    return value.strip().lower() in _TRUE


def load_config(conf_path: Optional[Path] = None, environ: Optional[Dict[str, str]] = None) -> E2EConfig:
    """Build the E2E config from the ini file (``FORGE_E2E_CONF`` / default) with env overrides."""
    env = os.environ if environ is None else environ
    path = Path(conf_path or env.get("FORGE_E2E_CONF") or DEFAULT_CONF)
    parser = configparser.ConfigParser(interpolation=None)
    if path.is_file():
        parser.read(path)
    elif conf_path or env.get("FORGE_E2E_CONF"):
        raise FileNotFoundError(f"E2E config not found: {path}")

    raw: Dict[str, str] = {}
    for key, (section, default) in _SPEC.items():
        value = env.get(f"FORGE_E2E_{key.upper()}", "").strip()
        if not value:
            value = parser.get(section, key, fallback="").strip()
        raw[key] = value or default

    mode = raw["mode"].lower()
    if mode not in UI_ONLY_MODES | {LIVE_MODE}:
        raise ValueError(f"mode must be 'ui-only', 'dry-run' or '{LIVE_MODE}', got {raw['mode']!r}")
    if mode == LIVE_MODE and not raw["backend_url"]:
        raise ValueError("live-proxmox mode requires [execution] backend_url (or FORGE_E2E_BACKEND_URL)")

    values: Dict[str, Any] = dict(raw)
    values["mode"] = "ui-only" if mode in UI_ONLY_MODES else mode
    for key in ("control_plane_nodes", "worker_nodes", "launch_timeout_seconds"):
        values[key] = int(raw[key])
    for key in ("verify_qm_status", "verify_kubectl", "verify_helm", "verify_nkp_dashboard"):
        values[key] = _truthy(raw[key])
    values["helm_releases"] = [item.strip().lower() for item in raw["helm_releases"].split(",") if item.strip()]
    values["backend_url"] = raw["backend_url"].rstrip("/")
    return E2EConfig(**values)


# ---------------------------------------------------------------------------
# IPAM safety guard (GET /api/v1/ipam)
# ---------------------------------------------------------------------------
def _ip_to_int(ip: str) -> int:
    a, b, c, d = (int(part) for part in ip.split("."))
    return ((a * 256 + b) * 256 + c) * 256 + d


def expand_ip_range(spec: str) -> List[str]:
    """``10.0.0.31-10.0.0.35`` (or a single IP) -> every address in the range."""
    if not spec:
        return []
    start, _, end = spec.partition("-")
    first, last = _ip_to_int(start.strip()), _ip_to_int((end or start).strip())
    return [".".join(str((n >> shift) & 255) for shift in (24, 16, 8, 0)) for n in range(first, last + 1)]


def find_ipam_conflicts(cfg: E2EConfig, slots: Iterable[Dict[str, Any]]) -> List[str]:
    """Human-readable conflicts between the target cluster/IPs and active (non-free) IPAM slots."""
    active = [slot for slot in slots if slot.get("status") != "free"]
    conflicts = [
        f"cluster '{cfg.cluster_name}' already holds IPAM slot {slot['ip']} ({slot['status']})"
        for slot in active
        if slot.get("cluster") == cfg.cluster_name
    ]
    wanted = set(expand_ip_range(cfg.control_plane_vip)) | set(expand_ip_range(cfg.metallb_range))
    conflicts += [
        f"configured IP {slot['ip']} is already allocated to '{slot.get('cluster') or slot['status']}'"
        for slot in active
        if slot["ip"] in wanted
    ]
    return conflicts
