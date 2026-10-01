from __future__ import annotations

import asyncio
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends

from ..schemas.secrets import SecretDeleteResponse, SecretItem, SecretListResponse, SecretSaveRequest
from ..services.secrets import delete_secret, list_secrets, save_secret
from .audit import record_audit_event
from .auth import require_admin_role

router = APIRouter(prefix="/api/v1/secrets", tags=["secrets"])


def _audit(verb: str, sec_type: str, cluster: Optional[str]) -> None:
    record_audit_event(
        run_id=f"secret-{uuid4().hex[:8]}",
        verb=verb,
        user="system-admin",
        status="succeeded",
        duration_sec=0.0,
        details={"sec_type": sec_type, "cluster": cluster},  # never includes the password
    )


@router.get("", response_model=SecretListResponse)
async def list_staged_secrets() -> SecretListResponse:
    """List staged Docker Hub / Harbor credential files under the cacrt directory (passwords masked)."""
    return SecretListResponse(secrets=await asyncio.to_thread(list_secrets))


@router.post("/save", response_model=SecretItem, dependencies=[Depends(require_admin_role)])
async def save_staged_secret(payload: SecretSaveRequest) -> SecretItem:
    """Stage Docker Hub or Harbor credentials as a chmod 600 INI (admin only)."""
    item = await asyncio.to_thread(save_secret, payload)
    _audit("secret-saved", payload.sec_type, payload.cluster)
    return item


@router.delete("/{sec_type}", response_model=SecretDeleteResponse, dependencies=[Depends(require_admin_role)])
async def delete_staged_secret(sec_type: str, cluster: Optional[str] = None) -> SecretDeleteResponse:
    """Delete a staged secret INI (`dockerhub`, or `harbor` with `?cluster=`); admin only."""
    await asyncio.to_thread(delete_secret, sec_type, cluster)
    _audit("secret-deleted", sec_type, cluster)
    return SecretDeleteResponse(sec_type=sec_type, cluster=cluster)
