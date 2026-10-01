from __future__ import annotations

from typing import List

from pydantic import BaseModel

from ..timeutil import UtcDatetime


class BackupItem(BaseModel):
    backup_id: str
    filename: str
    file_size_bytes: int
    created_at: UtcDatetime
    checksum_sha256: str


class BackupCreateResponse(BackupItem):
    status: str = "completed"


class BackupListResponse(BaseModel):
    backups: List[BackupItem]
