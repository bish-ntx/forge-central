from __future__ import annotations

import re
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from ..timeutil import UtcDatetime

LAB_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$")
IP_POOL_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}-\d{1,3}(\.\d{1,3}){3}$")
CONTROL_CHARS = re.compile(r"[\x00-\x1f]")
UNSAFE_INI_CHARS = re.compile(r'[\x00-\x1f"$`\\]')  # lab-infra files are sourced by bash


def safe_ini_text(value: Optional[str]) -> Optional[str]:
    """Reject control characters, quotes, `$`, backticks and backslashes in INI-bound values."""
    if value is not None and UNSAFE_INI_CHARS.search(value):
        raise ValueError("value contains unsafe characters")
    return value


class LabConfigRequest(BaseModel):
    lab_name: str
    pve_host: str = Field(min_length=1)
    pve_node: str = Field(min_length=1)
    pve_user: str = "root"
    pve_password: Optional[str] = None
    storage_pool: str = Field(min_length=1)
    resource_pool: Optional[str] = None
    network_bridge: str = "vmbr0"
    nameserver: str = Field(min_length=1)
    search_domain: Optional[str] = None
    lab_ip_pool: str  # e.g. 10.0.0.10-10.0.0.40
    golden_vmid: int = Field(default=100, ge=100)
    golden_name: str = "ubuntu-2404-golden"
    registry_type: str = "dockerhub"
    storage_mode: str = "local"

    @field_validator("lab_name")
    @classmethod
    def _lab_name(cls, value: str) -> str:
        if not LAB_NAME_RE.match(value):
            raise ValueError("lab_name must be alphanumeric with '-' or '_' (max 63 chars)")
        return value

    @field_validator("lab_ip_pool")
    @classmethod
    def _ip_pool(cls, value: str) -> str:
        if not IP_POOL_RE.match(value) or any(int(o) > 255 for o in re.findall(r"\d+", value)):
            raise ValueError("lab_ip_pool must look like 10.0.0.10-10.0.0.40")
        return value

    @field_validator("registry_type")
    @classmethod
    def _registry_type(cls, value: str) -> str:
        if value not in {"dockerhub", "harbor", "mirror"}:
            raise ValueError("registry_type must be dockerhub, harbor or mirror")
        return value

    @field_validator(
        "pve_host", "pve_node", "pve_user", "storage_pool", "resource_pool",
        "network_bridge", "nameserver", "search_domain", "golden_name", "storage_mode",
    )
    @classmethod
    def _safe_text(cls, value: Optional[str]) -> Optional[str]:
        return safe_ini_text(value)

    @field_validator("pve_password")
    @classmethod
    def _password(cls, value: Optional[str]) -> Optional[str]:
        # Escaped on write (like the CLI), so only line breaks / control characters are refused.
        if value is not None and CONTROL_CHARS.search(value):
            raise ValueError("password contains control characters")
        return value


class LabConfigResponse(BaseModel):
    """Current lab configuration parsed from `<lab>-infra.ini` (the password is never returned)."""

    configured: bool = False
    lab_name: str = ""
    config_path: Optional[str] = None
    labs: List[str] = Field(default_factory=list)
    pve_host: str = ""
    pve_node: str = ""
    pve_user: str = "root"
    has_password: bool = False
    storage_pool: str = ""
    resource_pool: Optional[str] = None
    network_bridge: str = "vmbr0"
    nameserver: str = ""
    search_domain: Optional[str] = None
    lab_ip_pool: str = ""
    golden_vmid: int = 100
    golden_name: str = "ubuntu-2404-golden"
    registry_type: str = "dockerhub"
    storage_mode: str = "local"


class LabInitResponse(BaseModel):
    status: str = "initialized"
    lab_name: str
    config_path: str
    updated_at: UtcDatetime
