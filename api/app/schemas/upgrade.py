from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class UpgradeStatusResponse(BaseModel):
    current_version: str
    last_upgrade_at: Optional[datetime] = None
    arch: str
    platform: str


class ValidationCheck(BaseModel):
    name: str
    passed: bool
    message: str


class UpgradeInspectRequest(BaseModel):
    bundle_path: str


class UpgradeInspectResponse(BaseModel):
    valid: bool
    current_version: str
    bundle_version: str
    checks: List[ValidationCheck]
