from __future__ import annotations

import re
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from ..timeutil import UtcDatetime
from .ipam import CLUSTER_NAME_RE
from .lab import LAB_NAME_RE, safe_ini_text


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
    worker_nodes: int = 4
    kubernetes_version: str = "v1.31.1"
    hypervisor_type: Literal["proxmox", "ahv"] = "proxmox"
    # Guided wizard flow (Task-27): when `lab_name` is set, the run chains
    # `forge provision vms` + `forge create cluster` against the generated <cluster>-input.ini.
    lab_name: Optional[str] = None
    target_runner: Literal["central", "bastion"] = "central"
    bastion_ip: Optional[str] = None
    nfs_mount: bool = True
    provision_vms: bool = True

    @field_validator("lab_name")
    @classmethod
    def _lab_name(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and not LAB_NAME_RE.match(value):
            raise ValueError("lab_name must be alphanumeric with '-' or '_' (max 63 chars)")
        return value

    @field_validator("bastion_ip")
    @classmethod
    def _bastion_ip(cls, value: Optional[str]) -> Optional[str]:
        return validate_bastion_host(value)


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
    steps: Optional[List[str]] = None  # ordered step labels of a chained run (wizard flow)


class ClusterDetailResponse(BaseModel):
    cluster: ClusterItem
    nodes: list[ClusterNodeItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Guided cluster config generator & bastion remote sync (Task-27)
# ---------------------------------------------------------------------------
HOST_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$")
NKP_VERSION_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+-]{0,31}$")
REGISTRY_TYPES = {"dockerhub", "harbor", "mirror"}


def validate_cluster_name(value: str) -> str:
    value = value.strip()
    if not CLUSTER_NAME_RE.match(value):
        raise ValueError("cluster_name must be 1-63 chars of letters, digits, '.', '_' or '-'")
    return value


def validate_bastion_host(value: Optional[str]) -> Optional[str]:
    """Bastion IP/hostname ends up in ssh/scp argv: refuse anything that is not a plain host."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if not HOST_RE.match(value):
        raise ValueError("bastion_ip must be an IP address or hostname")
    return value


class ClusterInitRequest(BaseModel):
    """Guided wizard payload for `POST /api/v1/clusters/init-config`."""

    cluster_name: str
    lab_name: str
    nkp_version: str
    registry_type: str = "dockerhub"
    storage_mode: str = "local"
    control_plane_nodes: int = Field(default=3, ge=1, le=9)
    worker_nodes: int = Field(default=4, ge=0, le=64)
    target_runner: Literal["central", "bastion"] = "central"
    bastion_ip: Optional[str] = None
    hypervisor_type: Literal["proxmox", "ahv"] = "proxmox"
    # Optional per-cluster Prism target override for Nutanix CSI modes (the password is always inherited from the lab).
    prism_endpoint: Optional[str] = None
    prism_port: Optional[int] = Field(default=None, ge=1, le=65535)
    prism_user: Optional[str] = None
    storage_container: Optional[str] = None

    @field_validator("prism_endpoint", "prism_user", "storage_container")
    @classmethod
    def _prism_text(cls, value: Optional[str]) -> Optional[str]:
        return safe_ini_text(value.strip()) if value else None

    @field_validator("cluster_name")
    @classmethod
    def _cluster_name(cls, value: str) -> str:
        return validate_cluster_name(value)

    @field_validator("lab_name")
    @classmethod
    def _lab_name(cls, value: str) -> str:
        if not LAB_NAME_RE.match(value):
            raise ValueError("lab_name must be alphanumeric with '-' or '_' (max 63 chars)")
        return value

    @field_validator("nkp_version")
    @classmethod
    def _nkp_version(cls, value: str) -> str:
        value = value.strip()
        if not NKP_VERSION_RE.match(value):
            raise ValueError("nkp_version contains unsupported characters")
        return value

    @field_validator("registry_type")
    @classmethod
    def _registry_type(cls, value: str) -> str:
        if value not in REGISTRY_TYPES:
            raise ValueError("registry_type must be dockerhub, harbor or mirror")
        return value

    @field_validator("storage_mode")
    @classmethod
    def _storage_mode(cls, value: str) -> str:
        if not value or safe_ini_text(value) != value:
            raise ValueError("storage_mode contains unsafe characters")
        return value

    @field_validator("bastion_ip")
    @classmethod
    def _bastion_ip(cls, value: Optional[str]) -> Optional[str]:
        return validate_bastion_host(value)

    @model_validator(mode="after")
    def _bastion_required(self) -> "ClusterInitRequest":
        if self.target_runner == "bastion" and not self.bastion_ip:
            raise ValueError("bastion_ip is required when target_runner is 'bastion'")
        return self


class ClusterInitResponse(BaseModel):
    cluster_name: str
    config_path: str
    vip_preview: Optional[str] = None
    metallb_range_preview: Optional[str] = None
    status: str
    lab_name: str = ""
    config_preview: str = ""
    commands: List[str] = Field(default_factory=list)
    free_ip_count: int = 0


class BastionSyncRequest(BaseModel):
    cluster_name: str
    bastion_ip: str
    nfs_mount: bool = True

    @field_validator("cluster_name")
    @classmethod
    def _cluster_name(cls, value: str) -> str:
        return validate_cluster_name(value)

    @field_validator("bastion_ip")
    @classmethod
    def _bastion_ip(cls, value: str) -> str:
        checked = validate_bastion_host(value)
        if not checked:
            raise ValueError("bastion_ip is required")
        return checked


class BastionSyncResponse(BaseModel):
    run_id: str
    cluster_name: str
    bastion_ip: str
    status: str
    steps: List[str] = Field(default_factory=list)
