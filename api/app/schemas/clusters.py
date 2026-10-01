from __future__ import annotations

from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from ..timeutil import UtcDatetime


class ClusterNodeItem(BaseModel):
    name: str
    role: Literal["control-plane", "worker", "unknown"] = "unknown"
    status: Literal["ready", "notready", "unknown"] = "unknown"


class MetalLbConfig(BaseModel):
    vip_range: str = ""
    address_pool: str = ""


class ClusterItem(BaseModel):
    name: str
    status: Literal["ready", "deploying", "failed", "unknown"] = "unknown"
    kubernetes_version: str = ""
    desired_nodes: int = 0
    ready_nodes: int = 0
    metallb: MetalLbConfig = Field(default_factory=MetalLbConfig)
    last_updated_at: Optional[UtcDatetime] = None


class ClusterListResponse(BaseModel):
    clusters: list[ClusterItem]


class ClusterCreateRequest(BaseModel):
    cluster_name: str
    control_plane_nodes: int = 3
    worker_nodes: int = 3
    kubernetes_version: str = "v1.31.1"
    hypervisor_type: Literal["proxmox", "ahv"] = "proxmox"


class ClusterNodepoolRequest(BaseModel):
    nodepool_name: str
    replicas: int = 1
    hypervisor_type: Literal["proxmox", "ahv"] = "proxmox"


class ClusterNodepoolItem(BaseModel):
    name: str
    replicas: int = 1
    hypervisor_type: Literal["proxmox", "ahv"] = "proxmox"
    status: str = "ready"


class ClusterNodepoolListResponse(BaseModel):
    nodepools: list[ClusterNodepoolItem]


class ClusterResetNodesRequest(BaseModel):
    node_names: Optional[list[str]] = None


class ClusterCommandResponse(BaseModel):
    run_id: UUID
    status: str
    command: str
    started_at: UtcDatetime
    safety_backup_id: Optional[str] = None


class ClusterDetailResponse(BaseModel):
    cluster: ClusterItem
    nodes: list[ClusterNodeItem] = Field(default_factory=list)
