from __future__ import annotations

import asyncio
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends

from ..schemas.lab import LabConfigRequest, LabConfigResponse, LabInitResponse
from ..services.lab import get_lab_config, init_lab
from .audit import record_audit_event
from .auth import require_admin_role

router = APIRouter(prefix="/api/v1/lab", tags=["lab"])


@router.get("/config", response_model=LabConfigResponse)
async def read_lab_config(lab: Optional[str] = None) -> LabConfigResponse:
    """Discover labs under `FORGE_HOME/labs/` and parse `<lab>-infra.ini` (first lab when `lab` is omitted)."""
    return await asyncio.to_thread(get_lab_config, lab)


@router.post("/init", response_model=LabInitResponse, dependencies=[Depends(require_admin_role)])
async def initialize_lab(payload: LabConfigRequest) -> LabInitResponse:
    """Validate and write `FORGE_HOME/labs/<lab>/<lab>-infra.ini` (admin only); records a `lab-initialized` audit event."""
    result = await asyncio.to_thread(init_lab, payload)
    record_audit_event(
        run_id=f"lab-init-{uuid4().hex[:8]}",
        verb="lab-initialized",
        user="system-admin",
        status="succeeded",
        duration_sec=0.0,
        details={"lab_name": payload.lab_name, "pve_host": payload.pve_host, "config_path": result.config_path},
    )
    return result
