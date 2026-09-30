from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class NodePrepRequest(BaseModel):
    address: str
    ssh_user: str
    conf: str
    node_type: Literal["wk", "cp", "gpu-wk", "bastion"]
    target_type: Literal["vm", "baremetal"] = "vm"
    admin_key: Optional[str] = None
    dry_run: bool = False


class NodePrepResponse(BaseModel):
    run_id: UUID
    status: str
    command: str
    started_at: datetime


class ShareMountRequest(BaseModel):
    from_ip: str
    path: Optional[str] = None
    target_bastion: Optional[str] = None
    reboot: bool = False
    dry_run: bool = False


class ShareStatusResponse(BaseModel):
    shares: list[dict[str, Any]] = Field(default_factory=list)
