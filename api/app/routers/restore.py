from __future__ import annotations

import asyncio

from fastapi import APIRouter

from ..schemas.restore import (
    RestoreExecuteRequest,
    RestoreExecuteResponse,
    RestoreVerifyRequest,
    RestoreVerifyResponse,
)
from ..services.restore import execute_restore, verify_backup

router = APIRouter(tags=["restore"])


@router.post("/restore/verify", response_model=RestoreVerifyResponse)
async def verify_state_backup(request: RestoreVerifyRequest) -> RestoreVerifyResponse:
    """Run pre-restore integrity checks (existence, SHA-256 match, archive readability) on a backup."""
    return await asyncio.to_thread(verify_backup, request.backup_id)


@router.post("/restore/execute", response_model=RestoreExecuteResponse)
async def execute_state_restore(request: RestoreExecuteRequest) -> RestoreExecuteResponse:
    """Verify a backup, take a pre-restore safety snapshot, then restore state, CA certs and the DB."""
    return await asyncio.to_thread(execute_restore, request.backup_id)
