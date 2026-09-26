# =============================================================================
# Forge Central — CLI Schemas
# Project: Forge Central Control Plane
# Version: 1.0.0
# Author:  Bishwajit Kumar <Bishwajit.Kumar@nutanix.com>
# Description: Request and response schemas for CLI execution APIs.
# =============================================================================

from __future__ import annotations

from datetime import datetime
from typing import Union
from uuid import UUID

from pydantic import BaseModel, Field


class CLIExecuteRequest(BaseModel):
    command: Union[str, list[str]]
    args: list[str] = Field(default_factory=list)
    env_overrides: dict[str, str] = Field(default_factory=dict)


class CLIExecuteResponse(BaseModel):
    run_id: UUID
    status: str
    command: str
    started_at: datetime


class HealthResponse(BaseModel):
    status: str
    forge_bin: str


class VersionResponse(BaseModel):
    control_plane_version: str
    forge_bin: str
    forge_version: str
