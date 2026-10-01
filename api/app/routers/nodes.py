from __future__ import annotations

from fastapi import APIRouter, Request

from ..config import get_settings
from ..schemas.nodes import (
    NodePrepRequest,
    NodePrepResponse,
    ShareMountRequest,
    ShareStatusResponse,
)
from ..services.mock_data import MOCK_SHARES
from .audit import record_audit_event

router = APIRouter(tags=["nodes"])

# Deterministic export/mount status until `./forge share status` exposes JSON output.
SHARE_STATUS_STATE: list[dict[str, str]] = [
    {"export": "/srv/forge-share", "client": "10.10.0.0/24", "type": "nfs", "status": "exported"},
    {"export": "/srv/forge-share", "client": "bastion-01", "type": "nfs", "status": "mounted"},
]


@router.post("/nodes/prep", response_model=NodePrepResponse, status_code=202)
async def prep_node(request: Request, payload: NodePrepRequest) -> NodePrepResponse:
    """Dispatch `./forge prep node` (forge-prep-node.sh) to prepare a node over SSH."""
    argv = [
        "prep",
        "node",
        "--address",
        payload.address,
        "--ssh-user",
        payload.ssh_user,
        "--conf",
        payload.conf,
        "--node-type",
        payload.node_type,
        "--target-type",
        payload.target_type,
    ]
    if payload.admin_key:
        argv += ["--admin-key", payload.admin_key]
    if payload.dry_run:
        argv.append("--dry-run")
    run = await request.app.state.process_runner.start_run(command="forge", args=argv)
    record_audit_event(
        run_id=str(run.run_id),
        verb="node-prep-dispatched",
        user="lab-operator",
        status="succeeded",
        duration_sec=0.0,
        details={
            "resource": "node",
            "target": payload.address,
            "node_type": payload.node_type,
            "target_type": payload.target_type,
            "dry_run": payload.dry_run,
        },
    )
    return NodePrepResponse(
        run_id=run.run_id,
        status=run.status.value,
        command=run.command,
        started_at=run.started_at,
    )


@router.post("/shares/mount", response_model=NodePrepResponse, status_code=202)
async def mount_share(request: Request, payload: ShareMountRequest) -> NodePrepResponse:
    """Dispatch `./forge share mount` (forge-share.sh) to mount a remote NFS export."""
    argv = ["share", "mount", "--from-ip", payload.from_ip]
    if payload.path:
        argv += ["--path", payload.path]
    if payload.target_bastion:
        argv += ["--target-bastion", payload.target_bastion]
    if payload.reboot:
        argv.append("--reboot")
    if payload.dry_run:
        argv.append("--dry-run")
    run = await request.app.state.process_runner.start_run(command="forge", args=argv)
    record_audit_event(
        run_id=str(run.run_id),
        verb="share-mount-dispatched",
        user="lab-operator",
        status="succeeded",
        duration_sec=0.0,
        details={
            "resource": "share",
            "target": payload.from_ip,
            "path": payload.path,
            "target_bastion": payload.target_bastion,
            "reboot": payload.reboot,
            "dry_run": payload.dry_run,
        },
    )
    return NodePrepResponse(
        run_id=run.run_id,
        status=run.status.value,
        command=run.command,
        started_at=run.started_at,
    )


@router.get("/shares/status", response_model=ShareStatusResponse)
async def share_status() -> ShareStatusResponse:
    """List configured NFS exports/mounts and their status."""
    return ShareStatusResponse(shares=MOCK_SHARES if get_settings().forge_mock_mode else SHARE_STATUS_STATE)
