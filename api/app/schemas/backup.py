from __future__ import annotations

from datetime import datetime
from typing import List

from pydantic import BaseModel


class BackupItem(BaseModel):
    backup_id: str
    filename: str
    file_size_bytes: int
    created_at: datetime
    checksum_sha256: str


class BackupCreateResponse(BackupItem):
    status: str = "completed"


class BackupListResponse(BaseModel):
    backups: List[BackupItem]
