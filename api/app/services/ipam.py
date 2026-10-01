"""IPAM ledger service: wraps ``./forge ipam <list|free|release|reconcile-vmids>``.

Mock mode (``FORGE_MOCK_MODE=true``) serves a deterministic in-memory ledger; live mode
delegates every operation to the ``./forge`` CLI (the Proxmox-notes ledger stays the source
of truth) and only parses its text output.
"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

from fastapi import HTTPException

from ..config import get_settings
from ..schemas.ipam import IpamReconcileResponse, IpamSlot, IpamStatusResponse
from .lab import discover_labs, lab_ini_path, read_ini

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
_VMID_RE = re.compile(r"VMID\s+(\d+)(?:\s+\(([^)]*)\))?")
_IN_USE_STATES = {"in-use", "in_use", "used", "allocated"}
_FREE_STATES = {"free", "available"}

MOCK_IP_POOL = "10.0.0.10-10.0.0.40"
_MOCK_PREFIX = "10.0.0."

# Mock fixtures: last octet -> (status, cluster, vmid, hostname, role). Everything else is free.
_MOCK_ASSIGNED: dict[int, tuple[str, str, Optional[int], Optional[str], str]] = {
    10: ("gateway", "", None, "lab-gateway", "gateway"),
    11: ("vip", "amd-nkp1", None, None, "control-plane-vip"),
    12: ("allocated", "amd-nkp1", 1001, "amd-nkp1-cp-01", "control-plane"),
    13: ("allocated", "amd-nkp1", 1002, "amd-nkp1-wk-01", "worker"),
    14: ("allocated", "amd-nkp1", 1003, "amd-nkp1-wk-02", "worker"),
    21: ("vip", "cirra-nkp1", None, None, "control-plane-vip"),
    22: ("allocated", "cirra-nkp1", 1101, "cirra-nkp1-cp-01", "control-plane"),
    23: ("allocated", "cirra-nkp1", 1102, "cirra-nkp1-wk-01", "worker"),
}


def _build_mock_ledger() -> List[IpamSlot]:
    slots: List[IpamSlot] = []
    for octet in range(10, 41):
        status, cluster, vmid, hostname, role = _MOCK_ASSIGNED.get(octet, ("free", "", None, None, ""))
        slots.append(
            IpamSlot(
                ip=f"{_MOCK_PREFIX}{octet}",
                status=status,  # type: ignore[arg-type]
                cluster=cluster or None,
                vmid=vmid,
                hostname=hostname,
                role=role or None,
            )
        )
    return slots


MOCK_LEDGER: List[IpamSlot] = _build_mock_ledger()


def reset_mock_ledger_for_tests() -> None:
    """Restore the deterministic mock ledger (releases mutate it in memory)."""
    global MOCK_LEDGER
    MOCK_LEDGER = _build_mock_ledger()


def is_mock_mode() -> bool:
    return get_settings().forge_mock_mode


def _summarize(slots: List[IpamSlot], ip_pool: str) -> IpamStatusResponse:
    free = sum(1 for slot in slots if slot.status == "free")
    return IpamStatusResponse(
        total_slots=len(slots),
        allocated_slots=len(slots) - free,
        free_slots=free,
        ip_pool=ip_pool,
        slots=slots,
        updated_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Live CLI helpers
# ---------------------------------------------------------------------------
def active_lab_conf() -> Optional[Path]:
    """Lab-infra INI of the first discovered lab (the active lab), if any."""
    labs = discover_labs()
    return lab_ini_path(labs[0]) if labs else None


def _conf_args() -> List[str]:
    conf = active_lab_conf()
    return ["--conf", str(conf)] if conf else []


def _lab_ip_pool() -> str:
    conf = active_lab_conf()
    if conf and conf.is_file():
        return read_ini(conf).get("LAB_IP_POOL", "")
    return ""


async def run_forge(forge_bin: Path, argv: List[str]) -> Tuple[int, str, str]:
    """Run ``forge <argv>`` and return (exit code, stdout, stderr) with ANSI colors stripped."""
    try:
        process = await asyncio.create_subprocess_exec(
            str(forge_bin),
            *argv,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except (FileNotFoundError, PermissionError) as exc:
        raise HTTPException(status_code=500, detail=f"forge CLI unavailable: {exc}") from exc
    stdout, stderr = await process.communicate()
    return (
        process.returncode if process.returncode is not None else 1,
        _ANSI_RE.sub("", stdout.decode(errors="replace")),
        _ANSI_RE.sub("", stderr.decode(errors="replace")),
    )


async def _forge_ipam(forge_bin: Path, argv: List[str]) -> str:
    code, stdout, stderr = await run_forge(forge_bin, ["ipam", *argv, *_conf_args()])
    if code != 0:
        raise HTTPException(status_code=500, detail=(stderr or stdout).strip() or "forge ipam command failed")
    return stdout


def parse_ipam_list(output: str) -> List[IpamSlot]:
    """Parse ``forge ipam list`` rows (``SLOT CP-VIP METALLB STATE CLUSTER``) into IP slots.

    Each ledger row yields the control-plane VIP slot and, when held, its MetalLB range slot.
    """
    slots: List[IpamSlot] = []
    for line in output.splitlines():
        tokens = line.split()
        if len(tokens) < 4 or tokens[3].lower() not in _IN_USE_STATES | _FREE_STATES:
            continue
        _slot, cp_vip, metallb, state = tokens[:4]
        cluster = tokens[4] if len(tokens) > 4 and tokens[4] not in {"—", "-"} else None
        if state.lower() in _FREE_STATES:
            slots.append(IpamSlot(ip=cp_vip, status="free"))
            continue
        slots.append(IpamSlot(ip=cp_vip, status="vip", cluster=cluster, role="control-plane-vip"))
        if metallb and metallb not in {"—", "-"}:
            slots.append(IpamSlot(ip=metallb, status="allocated", cluster=cluster, role="metallb-range"))
    return slots


def parse_reconcile(output: str) -> List[dict]:
    """Parse ``forge ipam reconcile-vmids`` into one detail entry per drifting VMID."""
    details: List[dict] = []
    section: Optional[str] = None
    for raw in output.splitlines():
        line = raw.strip()
        if line.startswith("claimed-but-not-live"):
            section = "claimed-but-not-live"
        elif line.startswith("live-but-not-claimed"):
            section = "live-but-not-claimed"
        elif section and line.startswith("-"):
            match = _VMID_RE.search(line)
            if match:
                entry: dict = {"type": section, "vmid": int(match.group(1))}
                if match.group(2):
                    entry["hostname"] = match.group(2)
                details.append(entry)
    return details


# ---------------------------------------------------------------------------
# Public service API
# ---------------------------------------------------------------------------
async def get_ledger(forge_bin: Path) -> IpamStatusResponse:
    """Full ledger state: synthetic in mock mode, parsed ``forge ipam list`` output when live."""
    if is_mock_mode():
        return _summarize([slot.model_copy() for slot in MOCK_LEDGER], MOCK_IP_POOL)
    return _summarize(parse_ipam_list(await _forge_ipam(forge_bin, ["list"])), _lab_ip_pool())


async def get_free_slots(forge_bin: Path) -> List[IpamSlot]:
    """Currently unassigned IP slots (``forge ipam free``)."""
    if is_mock_mode():
        return [slot.model_copy() for slot in MOCK_LEDGER if slot.status == "free"]
    return parse_ipam_list(await _forge_ipam(forge_bin, ["free"]))


async def release_cluster(forge_bin: Path, cluster_name: str) -> int:
    """Release the cluster's reservation; returns the number of IP slots freed (404 if none held)."""
    if is_mock_mode():
        held = [slot for slot in MOCK_LEDGER if slot.cluster == cluster_name and slot.status != "free"]
        if not held:
            raise HTTPException(status_code=404, detail=f"no IPAM reservation found for cluster: {cluster_name}")
        for slot in held:
            slot.status, slot.cluster, slot.vmid, slot.hostname, slot.role = "free", None, None, None, None
        return len(held)

    before = parse_ipam_list(await _forge_ipam(forge_bin, ["list"]))
    held_count = sum(1 for slot in before if slot.cluster == cluster_name)
    if held_count == 0:
        raise HTTPException(status_code=404, detail=f"no IPAM reservation found for cluster: {cluster_name}")
    # --force skips the CLI's interactive y/N prompt; the typed UI confirmation replaces it.
    await _forge_ipam(forge_bin, ["release", "--cluster", cluster_name, "--force"])
    return held_count


async def reconcile_vmids(forge_bin: Path) -> IpamReconcileResponse:
    """Read-only VMID ledger vs live Proxmox diff (``forge ipam reconcile-vmids``)."""
    if is_mock_mode():
        details: List[dict] = [
            {"type": "claimed-but-not-live", "vmid": 1004, "hostname": "amd-nkp1-wk-03"},
            {"type": "live-but-not-claimed", "vmid": 1201, "hostname": "orphan-vm-01"},
        ]
    else:
        details = parse_reconcile(await _forge_ipam(forge_bin, ["reconcile-vmids"]))
    return IpamReconcileResponse(
        discrepancies_found=len(details),
        details=details,
        status="drift-detected" if details else "in-sync",
    )
