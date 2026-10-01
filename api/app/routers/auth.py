from __future__ import annotations

import secrets
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from ..config import get_settings
from ..schemas.auth import UnlockAdminRequest, UnlockAdminResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

VIEWER_FORBIDDEN_DETAIL = "Viewer role cannot perform mutating actions"
ADMIN_REQUIRED_DETAIL = "Admin role required for Day-0 lab and secret changes"


def forbid_viewer(x_forge_role: Optional[str]) -> None:
    """Raise HTTP 403 when the caller declares the read-only `viewer` role via `X-Forge-Role`."""
    if (x_forge_role or "").strip().lower() == "viewer":
        raise HTTPException(status_code=403, detail=VIEWER_FORBIDDEN_DETAIL)


async def require_mutating_role(x_forge_role: Optional[str] = Header(default=None)) -> None:
    """FastAPI dependency: reject mutating requests sent with `X-Forge-Role: viewer`."""
    forbid_viewer(x_forge_role)


async def require_admin_role(x_forge_role: Optional[str] = Header(default=None)) -> None:
    """FastAPI dependency: Day-0 mutations require `X-Forge-Role: admin`; anything else gets HTTP 403."""
    if (x_forge_role or "").strip().lower() != "admin":
        raise HTTPException(status_code=403, detail=ADMIN_REQUIRED_DETAIL)


@router.post("/unlock-admin", response_model=UnlockAdminResponse)
async def unlock_admin(payload: UnlockAdminRequest) -> UnlockAdminResponse:
    """Validate the admin passphrase against `FORGE_ADMIN_PASSWORD`; 401 when it does not match."""
    expected = get_settings().forge_admin_password
    if not secrets.compare_digest(payload.passphrase.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid admin passphrase")
    return UnlockAdminResponse()
