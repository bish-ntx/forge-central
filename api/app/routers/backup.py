from __future__ import annotations

import asyncio

from fastapi import APIRouter

from ..schemas.backup import BackupCreateResponse, BackupListResponse
from ..services.backup import create_backup, list_backups

router = APIRouter(tags=["backup"])


@router.post("/backup/create", response_model=BackupCreateResponse)
async def create_state_backup() -> BackupCreateResponse:
    """Create a compressed `.tar.gz` archive of Forge Central state (logs excluded) in `FORGE_BACKUP_DIR`."""
    return await asyncio.to_thread(create_backup)


@router.get("/backup/list", response_model=BackupListResponse)
async def list_state_backups() -> BackupListResponse:
    """List existing state backup archives with size, creation time and SHA-256 checksum, newest first."""
    return BackupListResponse(backups=await asyncio.to_thread(list_backups))
