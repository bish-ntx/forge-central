"""Post-flight probes for live-proxmox mode: Proxmox (qm), kubectl, helm and the NKP dashboard.

Every probe shells out to the real tool (no re-implementation) and the parsers are pure functions so
they are unit-tested without a lab. Output is never echoed verbatim: dashboard credentials stay masked.
"""

from __future__ import annotations

import json
import os
import re
import ssl
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Sequence
from urllib.request import urlopen

from test_config import E2EConfig

_URL_RE = re.compile(r"https?://[^\s'\"<>]+")
_CRED_RE = re.compile(r"(token|password|passwd|credential|secret)\s*[:=]\s*\S+", re.IGNORECASE)
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")


def run(cmd: Sequence[str], timeout: int = 120) -> str:
    """Run a command, return stdout; raise AssertionError (stderr tail only) on failure."""
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)  # noqa: S603
    if result.returncode != 0:
        tail = _ANSI_RE.sub("", result.stderr or result.stdout).strip().splitlines()[-3:]
        raise AssertionError(f"{cmd[0]} {cmd[1] if len(cmd) > 1 else ''} failed ({result.returncode}): {' | '.join(tail)}")
    return _ANSI_RE.sub("", result.stdout)


# ---------------------------------------------------------------------------
# Pure parsers
# ---------------------------------------------------------------------------
def parse_qm_status(output: str) -> str:
    """``status: running`` -> ``running`` ('' when absent)."""
    match = re.search(r"status:\s*(\S+)", output)
    return match.group(1) if match else ""


def parse_nodes_ready(output: str) -> Dict[str, bool]:
    """``kubectl get nodes --no-headers`` -> {node: is_ready}."""
    nodes: Dict[str, bool] = {}
    for line in output.splitlines():
        cols = line.split()
        if len(cols) >= 2:
            nodes[cols[0]] = cols[1] == "Ready"
    return nodes


def parse_helm_releases(output: str) -> Dict[str, str]:
    """``helm list -A -o json`` -> {release_name: status}."""
    return {item["name"]: item.get("status", "") for item in json.loads(output or "[]")}


def parse_dashboard(output: str) -> Dict[str, object]:
    """Extract the dashboard URL and whether credentials were printed (values are never kept)."""
    urls = _URL_RE.findall(output)
    return {"url": urls[0].rstrip(".,)") if urls else "", "has_credentials": bool(_CRED_RE.search(output))}


# ---------------------------------------------------------------------------
# Probes
# ---------------------------------------------------------------------------
def probe_qm_running(cfg: E2EConfig, vmids: List[int]) -> Dict[int, str]:
    """``ssh <pve_ssh_user>@<pve_host> qm status <vmid>`` for each VM -> {vmid: status}."""
    target = f"{cfg.pve_ssh_user}@{cfg.pve_host}"
    return {
        vmid: parse_qm_status(run(["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", target, "qm", "status", str(vmid)]))
        for vmid in vmids
    }


def resolve_kubeconfig(cfg: E2EConfig) -> Path:
    """Configured kubeconfig, else the newest ``~/nkp/*/<cluster>.conf``."""
    if cfg.kubeconfig:
        path = Path(cfg.kubeconfig).expanduser()
    else:
        matches = sorted((Path.home() / "nkp").glob(f"*/{cfg.cluster_name}.conf"), key=lambda p: p.stat().st_mtime)
        path = matches[-1] if matches else Path.home() / "nkp" / f"{cfg.cluster_name}.conf"
    assert path.is_file(), f"kubeconfig not found: {path} (set [execution] kubeconfig)"
    return path


def probe_kubectl_nodes(kubeconfig: Path) -> Dict[str, bool]:
    return parse_nodes_ready(run(["kubectl", f"--kubeconfig={kubeconfig}", "get", "nodes", "--no-headers"]))


def probe_helm_releases(kubeconfig: Path) -> Dict[str, str]:
    return parse_helm_releases(run(["helm", "--kubeconfig", str(kubeconfig), "list", "-A", "-o", "json"]))


def resolve_forge_bin(cfg: E2EConfig) -> Path:
    candidate = cfg.forge_bin or os.environ.get("FORGE_BIN") or str(Path(__file__).resolve().parents[3] / "nkp-forge" / "forge")
    path = Path(candidate).expanduser()
    assert path.is_file(), f"forge CLI not found: {path} (set [execution] forge_bin or $FORGE_BIN)"
    return path


def probe_nkp_dashboard(forge_bin: Path, conf: Optional[Path]) -> Dict[str, object]:
    """``./forge get nkp-dashboard --conf <input.ini>`` + an HTTP GET of the printed URL (status only)."""
    argv = [str(forge_bin), "get", "nkp-dashboard"] + (["--conf", str(conf)] if conf else [])
    info = parse_dashboard(run(argv, timeout=180))
    assert info["url"], "forge get nkp-dashboard printed no dashboard URL"
    insecure = ssl.create_default_context()
    insecure.check_hostname = False
    insecure.verify_mode = ssl.CERT_NONE  # NKP dashboards use self-signed certificates
    with urlopen(str(info["url"]), timeout=30, context=insecure) as response:  # noqa: S310
        info["http_status"] = response.status
    return info
