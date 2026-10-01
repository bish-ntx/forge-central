# =============================================================================
# Forge Central — Hardware Discovery & PCI Passthrough Service (Task-28)
# Project: Forge Central Control Plane
# Version: 1.0.0
# Author:  Bishwajit Kumar <Bishwajit.Kumar@nutanix.com>
# Description: Discovers GPU / Pensando NIC PCI BDFs, resolves VM assignments and
#              builds the `./forge passthrough ...` / `./forge provision gpu-vms`
#              argv + env. Write operations stay delegated to the forge CLI.
# =============================================================================

from __future__ import annotations

import asyncio
import json
import re
import shutil
from typing import Any, Literal, Optional

from fastapi import HTTPException

from ..config import get_settings
from ..schemas.vms import PciDeviceItem
from .mock_data import MOCK_VMS
from .process_runner import ProcessRunner

DeviceType = Literal["gpu", "nic", "both"]

# <domain>:<bus>:<slot>.<fn>; the PCI domain is optional in `lspci` (without -D) output.
BDF_TOKEN = r"(?:[0-9a-fA-F]{4}:)?[0-9a-fA-F]{2}:[0-9a-fA-F]{2}\.[0-7]"
_DEVICE_LINE_RE = re.compile(rf"^\s*(?P<bdf>{BDF_TOKEN})\s+(?P<rest>\S.*)$")
# `forge passthrough list` rows: VMID NAME STATE SLOT BDF ROLE
_LIST_ROW_RE = re.compile(
    r"^\s*(?P<vmid>\d+)\s+(?P<name>\S+)\s+(?P<state>\S+)\s+(?P<slot>hostpci\d+)\s+"
    r"(?P<bdf>(?:[0-9a-fA-F]{4}:)?[0-9a-fA-F]{2}:[0-9a-fA-F]{2}(?:\.[0-7])?)\b"
)

# Realistic AMD Instinct MI350P GPUs and Pensando Pollara 400 NICs of a lab Proxmox host.
MOCK_PCI_DEVICES: list[dict[str, str]] = [
    {"pci_bdf": f"0000:{bus}:00.0", "device_type": "gpu", "vendor": "AMD",
     "description": "Display controller: Advanced Micro Devices, Inc. [AMD/ATI] Instinct MI350P [1002:75a0]"}
    for bus in ("05", "25", "45", "65")
] + [
    {"pci_bdf": f"0000:{bus}:00.0", "device_type": "nic", "vendor": "Pensando",
     "description": "Ethernet controller: Pensando Systems DSC Ethernet Controller Pollara 400 [1dd8:1002]"}
    for bus in ("07", "27", "47", "67")
]

# GPU worker VMs (300-series) that hold mock devices; merged with MOCK_VMS for power-state checks.
MOCK_GPU_WORKER_VMS: list[dict[str, Any]] = [
    {"vmid": 301, "name": "gpu-wk-01", "node": "pve-03", "status": "stopped",
     "pci_devices": ["0000:05:00.0", "0000:07:00.0"]},
    {"vmid": 302, "name": "gpu-wk-02", "node": "pve-03", "status": "running",
     "pci_devices": ["0000:25:00.0", "0000:27:00.0"]},
    {"vmid": 303, "name": "gpu-wk-03", "node": "pve-03", "status": "stopped", "pci_devices": []},
]


def normalize_bdf(value: str) -> str:
    """Lower-case a BDF and add the default `0000:` PCI domain when absent."""
    value = value.strip().lower()
    return value if value.count(":") == 2 else f"0000:{value}"


def _bdf_keys(bdf: str) -> set[str]:
    """Match keys for one device: the full BDF and its function-less form (`0000:ba:00`)."""
    full = normalize_bdf(bdf)
    return {full, full.rsplit(".", 1)[0]}


def classify_pci_line(rest: str) -> Optional[tuple[str, str]]:
    """Return `(device_type, vendor)` for a GPU/Pensando-NIC description, or None for other devices."""
    text = rest.lower()
    if "pensando" in text or "pollara" in text:
        return "nic", "Pensando"
    is_display = any(word in text for word in ("display controller", "3d controller", "vga compatible", "instinct"))
    if is_display and ("nvidia" in text):
        return "gpu", "NVIDIA"
    if is_display and any(word in text for word in ("advanced micro devices", "amd", "instinct")):
        return "gpu", "AMD"
    return None


def parse_pci_devices(output: str) -> list[PciDeviceItem]:
    """Parse `forge discover hardware --details` / `lspci -D` output into GPU & NIC devices."""
    devices: dict[str, PciDeviceItem] = {}
    for line in output.splitlines():
        match = _DEVICE_LINE_RE.match(line)
        if not match:
            continue
        classified = classify_pci_line(match.group("rest"))
        if classified is None:
            continue
        bdf = normalize_bdf(match.group("bdf"))
        devices.setdefault(
            bdf,
            PciDeviceItem(
                pci_bdf=bdf,
                device_type=classified[0],  # type: ignore[arg-type]
                vendor=classified[1],
                description=match.group("rest").strip(),
            ),
        )
    return sorted(devices.values(), key=lambda item: item.pci_bdf)


def parse_passthrough_list(output: str) -> list[dict[str, Any]]:
    """Parse `forge passthrough list` table rows into `{vmid, name, state, slot, bdf}` dicts."""
    rows: list[dict[str, Any]] = []
    for line in output.splitlines():
        match = _LIST_ROW_RE.match(line)
        if match:
            rows.append(
                {
                    "vmid": int(match.group("vmid")),
                    "name": match.group("name"),
                    "state": match.group("state"),
                    "slot": match.group("slot"),
                    "bdf": normalize_bdf(match.group("bdf")),
                }
            )
    return rows


def apply_assignments(devices: list[PciDeviceItem], assignments: list[dict[str, Any]]) -> list[PciDeviceItem]:
    """Annotate devices with the VM (vmid + name) currently holding them via hostpci."""
    owners: dict[str, tuple[int, str]] = {}
    for row in assignments:
        for key in _bdf_keys(str(row["bdf"])):
            owners[key] = (int(row["vmid"]), str(row["name"]))
    for device in devices:
        owner = next((owners[key] for key in _bdf_keys(device.pci_bdf) if key in owners), None)
        if owner:
            device.assigned_vmid, device.assigned_vm_name = owner
    return devices


def _mock_assignments() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for vm in [*MOCK_VMS, *MOCK_GPU_WORKER_VMS]:
        for index, bdf in enumerate(vm.get("pci_devices", [])):
            if any(item["pci_bdf"] == bdf for item in MOCK_PCI_DEVICES):
                rows.append({"vmid": vm["vmid"], "name": vm["name"], "state": vm.get("status", "unknown"),
                             "slot": f"hostpci{index}", "bdf": bdf})
    return rows


async def _capture(argv: list[str]) -> tuple[int, str, str]:
    """Run a read-only command and return `(returncode, stdout, stderr)`."""
    try:
        process = await asyncio.create_subprocess_exec(
            *argv, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
    except OSError as exc:
        return 127, "", str(exc)
    stdout, stderr = await process.communicate()
    return process.returncode or 0, stdout.decode(errors="replace"), stderr.decode(errors="replace")


async def discover_hardware(runner: ProcessRunner) -> list[PciDeviceItem]:
    """Return GPU/NIC PCI devices with VM assignments (fixtures in mock mode, forge CLI otherwise)."""
    if get_settings().forge_mock_mode:
        devices = [PciDeviceItem(**item) for item in MOCK_PCI_DEVICES]
        return apply_assignments(devices, _mock_assignments())

    forge = str(runner.forge_bin)
    code, stdout, stderr = await _capture([forge, "discover", "hardware", "--details"])
    devices = parse_pci_devices(stdout) if code == 0 else []
    if not devices:
        lspci = shutil.which("lspci")
        if lspci:
            lspci_code, lspci_out, lspci_err = await _capture([lspci, "-D"])
            devices = parse_pci_devices(lspci_out) if lspci_code == 0 else []
            stderr = stderr or lspci_err
        if not devices and code != 0:
            raise HTTPException(status_code=500, detail=stderr.strip() or "forge discover hardware failed")

    list_code, list_out, _ = await _capture([forge, "passthrough", "list"])
    assignments = parse_passthrough_list(list_out) if list_code == 0 else []
    return apply_assignments(devices, assignments)


async def get_vm(runner: ProcessRunner, vmid: int) -> dict[str, Any]:
    """Return the VM record (`vmid`, `name`, `status`, ...) or raise 404 when it does not exist."""
    if get_settings().forge_mock_mode:
        vms: list[dict[str, Any]] = [*MOCK_VMS, *MOCK_GPU_WORKER_VMS]
    else:
        code, stdout, stderr = await _capture([str(runner.forge_bin), "vm-list", "--json"])
        if code != 0:
            raise HTTPException(status_code=500, detail=stderr.strip() or "vm list command failed")
        try:
            payload = json.loads(stdout.strip() or "[]")
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=500, detail="forge vm list returned invalid JSON") from exc
        vms = payload["vms"] if isinstance(payload, dict) else payload
    for vm in vms:
        if isinstance(vm, dict) and int(vm.get("vmid", -1)) == vmid:
            return vm
    raise HTTPException(status_code=404, detail=f"VM {vmid} not found")


def require_stopped_or_force(vm: dict[str, Any], force_stop: bool, action: str) -> None:
    """Power-state guard: a running VM may only be re-wired when `force_stop` is set (409 otherwise)."""
    if str(vm.get("status", "unknown")).lower() == "running" and not force_stop:
        raise HTTPException(
            status_code=409,
            detail=(
                f"VM {vm.get('vmid')} ({vm.get('name', 'unknown')}) is running; stop it before "
                f"{action} or set force_stop=true to stop it first"
            ),
        )


def _device_env(gpu_bdf: Optional[str], nic_bdf: Optional[str]) -> dict[str, str]:
    env: dict[str, str] = {}
    if gpu_bdf:
        env["GPU_PCIE_DEVICE"] = gpu_bdf
    if nic_bdf:
        env["PENSANDO_NIC_PCIE_DEVICE"] = nic_bdf
    return env


def resolve_bdf_env(device_type: DeviceType, pci_bdf: Optional[str]) -> dict[str, str]:
    """Map a single `pci_bdf` onto the forge env var for `device_type` (ambiguous for `both` -> 400)."""
    if not pci_bdf:
        return {}
    if device_type == "both":
        raise HTTPException(status_code=400, detail="pci_bdf cannot be combined with device_type=both")
    return _device_env(pci_bdf if device_type == "gpu" else None, pci_bdf if device_type == "nic" else None)


def passthrough_args(
    action: Literal["attach", "detach"], vmid: int, device_type: DeviceType, force_stop: bool
) -> list[str]:
    """argv (after `./forge`) for `forge passthrough attach|detach`."""
    args = ["passthrough", action, "--vmid", str(vmid), "--device", device_type]
    if force_stop:
        args.append("--stop")
    return args


def gpu_provision_args(conf_path: str) -> list[str]:
    return ["provision", "gpu-vms", "--conf", conf_path]


def gpu_provision_env(count: int, gpu_bdf: Optional[str], nic_bdf: Optional[str]) -> dict[str, str]:
    env = {"GPU_WORKER_COUNT": str(count)}
    env.update(_device_env(gpu_bdf, nic_bdf))
    return env


def find_device(devices: list[PciDeviceItem], pci_bdf: str) -> PciDeviceItem:
    for device in devices:
        if device.pci_bdf == pci_bdf:
            return device
    raise HTTPException(status_code=404, detail=f"PCI device {pci_bdf} was not discovered on this host")


def check_bdf_usable(
    devices: list[PciDeviceItem],
    pci_bdf: str,
    expected_type: str,
    *,
    must_be_free: bool,
    vmid: Optional[int] = None,
) -> None:
    """Validate a user-chosen BDF: it exists, has the right class and (for attach) is unassigned."""
    device = find_device(devices, pci_bdf)
    if device.device_type != expected_type:
        raise HTTPException(
            status_code=400,
            detail=f"PCI device {pci_bdf} is a {device.device_type}, expected a {expected_type}",
        )
    if must_be_free and device.assigned_vmid is not None and device.assigned_vmid != vmid:
        raise HTTPException(
            status_code=409,
            detail=f"PCI device {pci_bdf} is already assigned to VM {device.assigned_vmid} "
            f"({device.assigned_vm_name or 'unknown'})",
        )
