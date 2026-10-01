from __future__ import annotations

import asyncio
import json
from typing import Any, Literal, Optional, Union

from fastapi import APIRouter, Header, HTTPException, Query, Request

from ..config import get_settings
from ..schemas.vms import (
    PciPassthroughRequest,
    VmActionRequest,
    VmBatchActionRequest,
    VmBatchActionResponse,
    VmCloneBatchRequest,
    VmCloneBatchResponse,
    VmCommandResponse,
    VmCreateRequest,
    VmItem,
    VmListResponse,
)
from ..services.backup import create_safety_snapshot
from ..services.mock_data import MOCK_VMS
from ..services.process_runner import ProcessRunner
from .audit import record_audit_event
from .auth import forbid_viewer

router = APIRouter(prefix="/api/v1/vms", tags=["vms"])


def get_runner(request: Request) -> ProcessRunner:
    return request.app.state.process_runner


def _status_matches(item_status: str, status_filter: str) -> bool:
    return item_status.lower() == status_filter.lower()


def _normalize_vm_item(raw: dict[str, Any]) -> VmItem:
    status = str(raw.get("status", "unknown")).lower()
    if status not in {"running", "stopped"}:
        status = "unknown"
    pci_devices = [str(device) for device in raw.get("pci_devices", [])]
    return VmItem(
        vmid=int(raw.get("vmid")),
        name=str(raw.get("name", f"vm-{raw.get('vmid', 'unknown')}")),
        node=str(raw.get("node", "unknown")),
        cores=int(raw.get("cores", 0)),
        memory_mb=int(raw.get("memory_mb", 0)),
        disk_gb=int(raw.get("disk_gb", 0)),
        status=status,  # type: ignore[arg-type]
        gpu_passthrough=bool(raw.get("gpu_passthrough", False)),
        pci_devices=pci_devices,
    )


async def _run_forge_json(
    runner: ProcessRunner, argv: list[str]
) -> Union[dict[str, Any], list[dict[str, Any]]]:
    process = await asyncio.create_subprocess_exec(
        str(runner.forge_bin),
        *argv,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    if process.returncode != 0:
        detail = stderr.decode(errors="replace").strip() or "vm list command failed"
        raise HTTPException(status_code=500, detail=detail)
    try:
        output = stdout.decode(errors="replace").strip()
        return json.loads(output) if output else []
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="forge vm list returned invalid JSON") from exc


@router.get("", response_model=VmListResponse)
async def list_vms(
    request: Request,
    node: Optional[str] = Query(default=None),
    status: Optional[Literal["running", "stopped"]] = Query(default=None),
) -> VmListResponse:
    """Return active VM inventory with optional node/status filtering."""
    if get_settings().forge_mock_mode:
        payload: Union[dict[str, Any], list[dict[str, Any]]] = MOCK_VMS
    else:
        payload = await _run_forge_json(get_runner(request), ["vm-list", "--json"])
    raw_vms = payload["vms"] if isinstance(payload, dict) else payload
    vm_items = [_normalize_vm_item(item) for item in raw_vms if isinstance(item, dict)]

    if node:
        vm_items = [vm for vm in vm_items if vm.node.lower() == node.lower()]
    if status:
        vm_items = [vm for vm in vm_items if _status_matches(vm.status, status)]
    return VmListResponse(vms=vm_items)


@router.post("/create", response_model=VmCommandResponse, status_code=202)
async def create_vm(request: Request, payload: VmCreateRequest) -> VmCommandResponse:
    """Queue VM provisioning through the forge CLI engine."""
    runner = get_runner(request)
    args = [
        "vm-create",
        "--name",
        payload.name,
        "--node",
        payload.node,
        "--cores",
        str(payload.cores),
        "--memory-mb",
        str(payload.memory_mb),
        "--disk-gb",
        str(payload.disk_gb),
        "--hypervisor-type",
        payload.hypervisor_type,
    ]
    run = await runner.start_run(command="forge", args=args)
    return VmCommandResponse(
        run_id=run.run_id,
        status=run.status.value,
        command=run.command,
        started_at=run.started_at,
    )


@router.post("/batch-action", response_model=VmBatchActionResponse, status_code=202)
async def vm_batch_action(
    request: Request,
    payload: VmBatchActionRequest,
    x_forge_role: Optional[str] = Header(default=None),
) -> VmBatchActionResponse:
    """Queue a lifecycle action for multiple VMs; `destroy` first takes a safety snapshot.

    Callers sending `X-Forge-Role: viewer` receive HTTP 403.
    """
    forbid_viewer(x_forge_role)
    runner = get_runner(request)
    snapshot = (
        create_safety_snapshot("vm-batch-destroy", f"{len(payload.vmids)}-vms")
        if payload.action == "destroy"
        else None
    )
    run = await runner.start_run(
        command="forge",
        args=[
            "vm-batch-action",
            "--action",
            payload.action,
            "--vmids",
            ",".join(str(v) for v in payload.vmids),
        ],
    )
    record_audit_event(
        run_id=str(run.run_id),
        verb=f"vm-batch-{payload.action}",
        user="lab-operator",
        status="succeeded",
        duration_sec=4.5,
        details={"action": payload.action, "vmids": payload.vmids},
    )
    return VmBatchActionResponse(
        run_id=run.run_id,
        status=run.status.value,
        action=payload.action,
        affected_vmids=payload.vmids,
        started_at=run.started_at,
        safety_backup_id=snapshot.backup_id if snapshot else None,
    )


@router.post("/clone-batch", response_model=VmCloneBatchResponse, status_code=202)
async def vm_clone_batch(request: Request, payload: VmCloneBatchRequest) -> VmCloneBatchResponse:
    """Queue batch cloning of a VM template through the forge CLI engine."""
    runner = get_runner(request)
    run = await runner.start_run(
        command="forge",
        args=[
            "vm-clone-batch",
            "--template-id",
            str(payload.template_id),
            "--count",
            str(payload.count),
            "--base-name",
            payload.base_name,
            "--node",
            payload.node,
        ],
    )
    record_audit_event(
        run_id=str(run.run_id),
        verb="vm-clone-batch",
        user="lab-operator",
        status="succeeded",
        duration_sec=12.0,
        details={
            "template_id": payload.template_id,
            "count": payload.count,
            "base_name": payload.base_name,
        },
    )
    return VmCloneBatchResponse(
        run_id=run.run_id,
        status=run.status.value,
        command=run.command,
        started_at=run.started_at,
    )


@router.post("/{vmid}/action", response_model=VmCommandResponse, status_code=202)
async def vm_action(vmid: int, request: Request, payload: VmActionRequest) -> VmCommandResponse:
    """Queue VM lifecycle action (start/stop/restart/destroy)."""
    runner = get_runner(request)
    run = await runner.start_run(
        command="forge",
        args=["vm-action", "--vmid", str(vmid), "--action", payload.action],
    )
    return VmCommandResponse(
        run_id=run.run_id,
        status=run.status.value,
        command=run.command,
        started_at=run.started_at,
    )


@router.post("/pci-passthrough", response_model=VmCommandResponse, status_code=202)
async def vm_pci_passthrough(request: Request, payload: PciPassthroughRequest) -> VmCommandResponse:
    """Queue a PCI passthrough attach operation for a VM."""
    runner = get_runner(request)
    run = await runner.start_run(
        command="forge",
        args=[
            "vm-pci-passthrough",
            "--vmid",
            str(payload.vmid),
            "--pci-id",
            payload.pci_id,
            "--hostpci-index",
            str(payload.hostpci_index),
        ],
    )
    return VmCommandResponse(
        run_id=run.run_id,
        status=run.status.value,
        command=run.command,
        started_at=run.started_at,
    )
