from __future__ import annotations

import time
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, Request

from ..schemas.ipam import (
    IpamReconcileResponse,
    IpamReleaseRequest,
    IpamReleaseResponse,
    IpamSlot,
    IpamStatusResponse,
)
from ..services import ipam as ipam_service
from ..services.backup import create_safety_snapshot
from .audit import record_audit_event
from .auth import require_mutating_role

router = APIRouter(prefix="/api/v1/ipam", tags=["ipam"])


def _forge_bin(request: Request):
    return request.app.state.process_runner.forge_bin


@router.get("", response_model=IpamStatusResponse)
async def get_ipam_ledger(request: Request) -> IpamStatusResponse:
    """Return the full IPAM ledger: allocated, VIP, gateway and free slots with capacity totals."""
    return await ipam_service.get_ledger(_forge_bin(request))


@router.get("/free", response_model=List[IpamSlot])
async def list_free_ipam_slots(request: Request) -> List[IpamSlot]:
    """Return only the currently unassigned IP slots (`forge ipam free`)."""
    return await ipam_service.get_free_slots(_forge_bin(request))


@router.post("/release", response_model=IpamReleaseResponse, dependencies=[Depends(require_mutating_role)])
async def release_ipam_reservation(request: Request, payload: IpamReleaseRequest) -> IpamReleaseResponse:
    """Release a cluster's IP reservation (`forge ipam release --cluster <name>`).

    Requires the Operator or Admin role (`X-Forge-Role: viewer` gets HTTP 403). A safety
    snapshot is taken first and an `ipam-released` audit event is recorded.
    """
    started = time.monotonic()
    snapshot = create_safety_snapshot("ipam-release", payload.cluster_name)
    released = await ipam_service.release_cluster(_forge_bin(request), payload.cluster_name)
    record_audit_event(
        run_id=f"ipam-release-{uuid4().hex[:8]}",
        verb="ipam-released",
        user="lab-operator",
        status="succeeded",
        duration_sec=round(time.monotonic() - started, 3),
        details={
            "cluster_name": payload.cluster_name,
            "released_count": released,
            "safety_backup_id": snapshot.backup_id,
        },
    )
    return IpamReleaseResponse(
        released_count=released,
        cluster_name=payload.cluster_name,
        status="released",
        safety_backup_id=snapshot.backup_id,
    )


@router.post("/reconcile", response_model=IpamReconcileResponse)
async def reconcile_ipam_vmids(request: Request) -> IpamReconcileResponse:
    """Run the read-only VMID drift diagnostic (`forge ipam reconcile-vmids`); nothing is modified."""
    return await ipam_service.reconcile_vmids(_forge_bin(request))
