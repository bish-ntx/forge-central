from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


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
    started_at: datetime
