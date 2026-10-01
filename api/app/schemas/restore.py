from __future__ import annotations

from typing import Any, List

from pydantic import BaseModel, Field


class RestoreVerifyRequest(BaseModel):
    backup_id: str


class RestoreVerifyCheck(BaseModel):
    name: str
    passed: bool
    message: str


class RestoreVerifyResponse(BaseModel):
    valid: bool
    backup_id: str
    filename: str
    manifest: dict[str, Any] = Field(default_factory=dict)
    checks: List[RestoreVerifyCheck]


class RestoreExecuteRequest(BaseModel):
    backup_id: str


class RestoreExecuteResponse(BaseModel):
    restore_id: str
    restored_files_count: int
    safety_backup_id: str
    status: str = "completed"
