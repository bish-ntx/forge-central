"""Guided cluster config generator & bastion remote sync (Task-27).

Writes ``<FORGE_STATE_DIR>/<cluster>/<cluster>-input.ini`` (inheriting the lab-level, non-secret
fields of ``<lab>-infra.ini``) with free IPAM candidates pre-selected, and builds the
``./forge share mount`` / ``./forge provision vms`` / ``./forge create cluster`` step chains.
All write operations on infrastructure stay delegated to the ``./forge`` CLI: this module only
renders the config file and describes the CLI steps; ``ProcessRunner.start_sequence`` runs them.
"""

from __future__ import annotations

import asyncio
import ipaddress
import shlex
import shutil
import socket
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

from fastapi import HTTPException

from ..config import get_settings
from ..schemas.clusters import ClusterInitRequest, ClusterInitResponse
from ..timeutil import iso_utc
from . import ipam as ipam_service
from .lab import get_lab_config, ini_assign, lab_ini_path, write_private_file
from .process_runner import RunStep

METALLB_BLOCK_SIZE = 5
SSH_OPTIONS = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new"]

STEP_SYNC = "Sync config to bastion"
STEP_PROVISION = "Provision VMs"
STEP_CREATE = "Create cluster"


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
def cluster_input_path(cluster_name: str) -> Path:
    """``<FORGE_STATE_DIR>/<cluster>/<cluster>-input.ini`` (the path ``forge init nkp-cluster`` writes)."""
    return get_settings().forge_state_dir.expanduser() / cluster_name / f"{cluster_name}-input.ini"


def bastion_input_path(cluster_name: str) -> str:
    """Remote (bastion) path of the cluster INI, relative to the bastion user's ``$HOME``."""
    return f"{get_settings().forge_bastion_state_dir}/{cluster_name}/{cluster_name}-input.ini"


# ---------------------------------------------------------------------------
# IPAM candidate selection
# ---------------------------------------------------------------------------
def _ipv4(value: str) -> Optional[int]:
    try:
        return int(ipaddress.IPv4Address(value))
    except ValueError:
        return None


def suggest_ip_plan(
    candidates: List[Tuple[str, Optional[str]]], block_size: int = METALLB_BLOCK_SIZE
) -> Tuple[Optional[str], Optional[str]]:
    """Pick (control-plane VIP, MetalLB range) from free IPAM candidates.

    The first free address is the VIP. When the ledger row carries its own MetalLB range it is
    used verbatim; otherwise the longest-possible contiguous block (up to ``block_size``) of
    other free addresses is chosen, preferring the run directly after the VIP.
    """
    if not candidates:
        return None, None
    vip, ledger_range = candidates[0]
    if ledger_range:
        return vip, ledger_range
    vip_int = _ipv4(vip)
    free = sorted({n for n in (_ipv4(ip) for ip, _ in candidates[1:]) if n is not None and n != vip_int})
    if not free:
        return vip, None

    runs: List[List[int]] = []
    for number in free:
        if runs and number == runs[-1][-1] + 1:
            runs[-1].append(number)
        else:
            runs.append([number])
    after_vip = next((run for run in runs if vip_int is not None and run[0] == vip_int + 1), None)
    chosen = after_vip or next((run for run in runs if len(run) >= 2), runs[0])
    block = chosen[:block_size]
    start, end = str(ipaddress.IPv4Address(block[0])), str(ipaddress.IPv4Address(block[-1]))
    return vip, f"{start}-{end}"


# ---------------------------------------------------------------------------
# Central address detection
# ---------------------------------------------------------------------------
def _detect_central_ip(peer: str) -> str:
    """Local address used to reach ``peer`` (UDP connect sends no packets)."""
    try:
        target = socket.gethostbyname(peer)
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect((target, 9))
            return sock.getsockname()[0]
    except OSError:
        return ""


async def resolve_central_ip(peer: str) -> str:
    """Forge Central address bastions mount from: ``FORGE_CENTRAL_IP`` or auto-detected towards ``peer``."""
    configured = get_settings().forge_central_ip
    if configured:
        return configured
    detected = await asyncio.to_thread(_detect_central_ip, peer)
    if not detected or detected.startswith("127."):
        raise HTTPException(status_code=400, detail="cannot determine the Forge Central IP; set FORGE_CENTRAL_IP")
    return detected


# ---------------------------------------------------------------------------
# CLI step builders
# ---------------------------------------------------------------------------
def _ssh_step(host: str, remote_tokens: List[str], label: str) -> RunStep:
    user = get_settings().forge_bastion_user
    return RunStep(
        argv=["ssh", *SSH_OPTIONS, f"{user}@{host}", shlex.join(remote_tokens)],
        label=label,
        external=True,
    )


def build_sync_steps(cluster_name: str, bastion_ip: str, central_ip: str, nfs_mount: bool) -> List[RunStep]:
    """Stage ``<cluster>-input.ini`` on the bastion: NFS share mount, or ssh mkdir + scp."""
    if nfs_mount:
        return [
            RunStep(
                argv=["share", "mount", "--from", central_ip, "--target", bastion_ip],
                label=f"{STEP_SYNC} (NFS share mount)",
            )
        ]
    settings = get_settings()
    remote = bastion_input_path(cluster_name)
    remote_dir = remote.rsplit("/", 1)[0]
    return [
        _ssh_step(bastion_ip, ["mkdir", "-p", remote_dir], f"{STEP_SYNC} (prepare directory)"),
        RunStep(
            argv=[
                "scp",
                *SSH_OPTIONS,
                str(cluster_input_path(cluster_name)),
                f"{settings.forge_bastion_user}@{bastion_ip}:{remote}",
            ],
            label=f"{STEP_SYNC} (scp)",
            external=True,
        ),
    ]


def build_deploy_steps(
    cluster_name: str,
    target_runner: str,
    bastion_ip: Optional[str] = None,
    central_ip: str = "",
    nfs_mount: bool = True,
    provision_vms: bool = True,
) -> List[RunStep]:
    """Ordered steps that deploy the cluster from its generated INI on Central or on the bastion."""
    if target_runner == "bastion":
        if not bastion_ip:
            raise HTTPException(status_code=400, detail="bastion_ip is required when target_runner is 'bastion'")
        conf = bastion_input_path(cluster_name)
        forge_remote = get_settings().forge_bastion_forge_path
        steps = build_sync_steps(cluster_name, bastion_ip, central_ip, nfs_mount)
        if provision_vms:
            steps.append(
                _ssh_step(
                    bastion_ip,
                    [forge_remote, "provision", "vms", "--skip-bastion", "--conf", conf],
                    f"{STEP_PROVISION} (bastion)",
                )
            )
        steps.append(
            _ssh_step(bastion_ip, [forge_remote, "create", "cluster", "--conf", conf], f"{STEP_CREATE} (bastion)")
        )
        return steps

    conf = str(cluster_input_path(cluster_name))
    steps = []
    if provision_vms:
        steps.append(RunStep(argv=["provision", "vms", "--skip-bastion", "--conf", conf], label=STEP_PROVISION))
    steps.append(RunStep(argv=["create", "cluster", "--conf", conf], label=STEP_CREATE))
    return steps


def init_command(payload: ClusterInitRequest, lab_ini: Path) -> str:
    """The ``./forge init nkp-cluster`` invocation equivalent to the generated config."""
    tokens = [
        "./forge", "init", "nkp-cluster",
        "--cluster", payload.cluster_name,
        "--lab-infra", str(lab_ini),
        "--nkp-version", payload.nkp_version,
        "--registry-type", payload.registry_type,
        "--storage-mode", payload.storage_mode,
        "--non-interactive", "--force",
    ]
    return " ".join(shlex.quote(token) if token != "./forge" else token for token in tokens)


# ---------------------------------------------------------------------------
# Config generation
# ---------------------------------------------------------------------------
def _render_config(
    payload: ClusterInitRequest,
    lab_ini: Path,
    lab,
    vip: Optional[str],
    metallb: Optional[str],
    central_ip: str,
    now: datetime,
) -> List[str]:
    """Render the cluster INI. Lab credentials (``PVE_PASSWORD``) are never copied."""
    fields: List[Tuple[str, object]] = [
        ("LAB_ENV", str(lab_ini)),
        ("CLUSTER_NAME", payload.cluster_name),
        ("NKP_CLI_VERSION", payload.nkp_version),
        ("PLATFORM", payload.hypervisor_type),
        ("CONTROL_PLANE_COUNT", payload.control_plane_nodes),
        ("WORKER_COUNT", payload.worker_nodes),
        ("REGISTRY_TYPE", payload.registry_type),
        ("STORAGE_MODE", payload.storage_mode),
        ("KUBE_VIP", vip or ""),
        ("METALLB_RANGE", metallb or ""),
    ]
    inherited: List[Tuple[str, object]] = [
        ("PVE_CLUSTER_HOST", lab.pve_host),
        ("PVE_TARGET_NODE", lab.pve_node),
        ("PVE_USER", lab.pve_user),
        ("RESOURCE_POOL", lab.resource_pool or ""),
        ("STORAGE_POOL", lab.storage_pool),
        ("NETWORK_BRIDGE", lab.network_bridge),
        ("NAMESERVER", lab.nameserver),
        ("SEARCH_DOMAIN", lab.search_domain or ""),
        ("LAB_IP_POOL", lab.lab_ip_pool),
        ("GOLDEN_TEMPLATE_VMID", lab.golden_vmid),
        ("GOLDEN_TEMPLATE_NAME", lab.golden_name),
    ]
    if payload.storage_mode.startswith("nutanix-csi"):
        # Prism PE/PC target: per-cluster override wins over the lab value (PRISM_PASSWORD stays in the lab file).
        inherited += [
            ("PRISM_ENDPOINT", payload.prism_endpoint or lab.prism_endpoint or ""),
            ("PRISM_PORT", payload.prism_port or lab.prism_port),
            ("PRISM_USER", payload.prism_user or lab.prism_user or ""),
            ("STORAGE_CONTAINER", payload.storage_container or lab.storage_container or ""),
        ]
    lines = [
        f"# Forge Central — Cluster Input: {payload.cluster_name}",
        f"# Generated by the Forge Central cluster wizard on {iso_utc(now)} (lab: {payload.lab_name}).",
        "# KUBE_VIP / METALLB_RANGE were pre-selected from free IPAM slots; blank means 'let IPAM allocate'.",
        *(ini_assign(key, value) for key, value in fields),
        "",
        f"# Lab-level values inherited from {lab_ini.name} (credentials are never copied)",
        *(ini_assign(key, value) for key, value in inherited),
    ]
    if payload.target_runner == "bastion":
        lines += ["", "# Execution on the cluster bastion", ini_assign("FORGE_CENTRAL_IP", central_ip)]
    return lines


async def initialize_cluster_config(forge_bin: Path, payload: ClusterInitRequest) -> ClusterInitResponse:
    """Discover the lab, pick free IPAM candidates and write ``<cluster>-input.ini`` (chmod 600)."""
    lab = await asyncio.to_thread(get_lab_config, payload.lab_name)
    if not lab.configured:
        raise HTTPException(status_code=404, detail=f"lab not found: {payload.lab_name}")
    lab_ini = lab_ini_path(payload.lab_name)

    candidates = await ipam_service.get_free_candidates(forge_bin)
    vip, metallb = suggest_ip_plan(candidates)

    central_ip = ""
    if payload.target_runner == "bastion":
        central_ip = await resolve_central_ip(payload.bastion_ip or "")

    now = datetime.now(timezone.utc)
    path = cluster_input_path(payload.cluster_name)
    lines = _render_config(payload, lab_ini, lab, vip, metallb, central_ip, now)

    def _write() -> None:
        if path.is_file():
            shutil.copy2(path, path.with_name(path.name + ".bak"))
        write_private_file(path, lines)

    await asyncio.to_thread(_write)

    commands = [init_command(payload, lab_ini)]
    commands += [
        step.display
        for step in build_deploy_steps(
            payload.cluster_name,
            payload.target_runner,
            payload.bastion_ip,
            central_ip,
            nfs_mount=True,
        )
    ]
    return ClusterInitResponse(
        cluster_name=payload.cluster_name,
        config_path=str(path),
        vip_preview=vip,
        metallb_range_preview=metallb,
        status="initialized",
        lab_name=payload.lab_name,
        config_preview="\n".join(lines) + "\n",
        commands=commands,
        free_ip_count=len(candidates),
    )


def require_cluster_config(cluster_name: str) -> Path:
    """Return the generated cluster INI path or fail with a hint to run init-config first."""
    path = cluster_input_path(cluster_name)
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"cluster config not found: {path.name}; call POST /api/v1/clusters/init-config first",
        )
    return path
