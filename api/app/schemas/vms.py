from __future__ import annotations

import re
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from ..timeutil import UtcDatetime
from .clusters import validate_cluster_name


class VmItem(BaseModel):
    vmid: int
    name: str
    node: str
    cores: int
    memory_mb: int
    disk_gb: int
    status: Literal["running", "stopped", "unknown"] = "unknown"
    gpu_passthrough: bool = False
    pci_devices: list[str] = Field(default_factory=list)


class VmListResponse(BaseModel):
    vms: list[VmItem]


class VmCreateRequest(BaseModel):
    name: str
    node: str
    cores: int
    memory_mb: int
    disk_gb: int
    hypervisor_type: Literal["proxmox", "ahv"] = "proxmox"


class VmActionRequest(BaseModel):
    action: Literal["start", "stop", "restart", "destroy"]


class PciPassthroughRequest(BaseModel):
    vmid: int
    pci_id: str
    hostpci_index: int = 0


class VmCommandResponse(BaseModel):
    run_id: UUID
    status: str
    command: str
    started_at: UtcDatetime


class VmBatchActionRequest(BaseModel):
    vmids: list[int]
    action: Literal["start", "stop", "restart", "destroy"]


class VmBatchActionResponse(BaseModel):
    run_id: UUID
    status: str = "PENDING"
    action: str
    affected_vmids: list[int]
    started_at: UtcDatetime
    safety_backup_id: Optional[str] = None


class VmCloneBatchRequest(BaseModel):
    template_id: int
    count: int = 1
    base_name: str
    node: str = "pve-a"
    start_vmid: Optional[int] = None


class VmCloneBatchResponse(BaseModel):
    run_id: UUID
    status: str = "PENDING"
    command: str
    created_vms: list[dict[str, Any]] = Field(default_factory=list)
    started_at: UtcDatetime


# ---------------------------------------------------------------------------
# Hardware discovery, PCI passthrough & GPU VM provisioning (Task-28)
# ---------------------------------------------------------------------------
PCI_BDF_RE = re.compile(r"^[0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\.[0-7]$")


def _validate_optional_bdf(value: Optional[str]) -> Optional[str]:
    """PCI BDFs end up in forge env overrides: accept only canonical `dddd:bb:ss.f` values."""
    if value is None or not value.strip():
        return None
    value = value.strip().lower()
    if not PCI_BDF_RE.match(value):
        raise ValueError("PCI BDF must look like 0000:ba:00.0")
    return value


class PciDeviceItem(BaseModel):
    pci_bdf: str
    device_type: Literal["gpu", "nic", "other"] = "other"
    description: str = ""
    vendor: str = ""
    assigned_vmid: Optional[int] = None
    assigned_vm_name: Optional[str] = None


class HardwareDiscoveryResponse(BaseModel):
    pci_devices: list[PciDeviceItem]
    total_gpus: int
    total_nics: int
    discovered_at: UtcDatetime


class PassthroughActionRequest(BaseModel):
    vmid: Optional[int] = Field(default=None, description="Optional; the VMID in the URL path is authoritative")
    device_type: Literal["gpu", "nic", "both"] = "gpu"
    pci_bdf: Optional[str] = None
    force_stop: bool = False

    @field_validator("pci_bdf")
    @classmethod
    def _pci_bdf(cls, value: Optional[str]) -> Optional[str]:
        return _validate_optional_bdf(value)


class PassthroughActionResponse(BaseModel):
    run_id: UUID
    status: str
    command: str
    action: Literal["attach", "detach"]
    vmid: int
    device_type: str
    force_stop: bool = False
    started_at: UtcDatetime


class GpuVmProvisionRequest(BaseModel):
    cluster_name: str
    gpu_worker_count: int = Field(default=1, ge=1, le=16)
    gpu_bdf: Optional[str] = None
    nic_bdf: Optional[str] = None

    @field_validator("cluster_name")
    @classmethod
    def _cluster_name(cls, value: str) -> str:
        return validate_cluster_name(value)

    @field_validator("gpu_bdf", "nic_bdf")
    @classmethod
    def _bdfs(cls, value: Optional[str]) -> Optional[str]:
        return _validate_optional_bdf(value)


class GpuVmProvisionResponse(BaseModel):
    run_id: UUID
    status: str
    command: str
    cluster_name: str
    gpu_worker_count: int
    conf_path: str
    started_at: UtcDatetime
