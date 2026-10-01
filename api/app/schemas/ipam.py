from __future__ import annotations

import re
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from ..timeutil import UtcDatetime

# Cluster names are passed to `./forge ipam release --cluster <name>`: keep them argv-safe.
CLUSTER_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$")

IpamSlotStatus = Literal["allocated", "free", "vip", "gateway"]


class IpamSlot(BaseModel):
    ip: str
    status: IpamSlotStatus
    cluster: Optional[str] = None
    vmid: Optional[int] = None
    hostname: Optional[str] = None
    role: Optional[str] = None


class IpamStatusResponse(BaseModel):
    total_slots: int
    allocated_slots: int
    free_slots: int
    ip_pool: str
    slots: List[IpamSlot]
    updated_at: UtcDatetime


class IpamReleaseRequest(BaseModel):
    cluster_name: str

    @field_validator("cluster_name")
    @classmethod
    def _valid_cluster_name(cls, value: str) -> str:
        value = value.strip()
        if not CLUSTER_NAME_RE.match(value):
            raise ValueError("cluster_name must be 1-63 chars of letters, digits, '.', '_' or '-'")
        return value


class IpamReleaseResponse(BaseModel):
    released_count: int
    cluster_name: str
    status: str
    safety_backup_id: Optional[str] = None


class IpamReconcileResponse(BaseModel):
    discrepancies_found: int
    details: List[Dict[str, Any]] = Field(default_factory=list)
    status: str
