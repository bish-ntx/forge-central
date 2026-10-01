from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Optional, Union
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request

from ..config import get_settings
from ..schemas.clusters import (
    BastionSyncRequest,
    BastionSyncResponse,
    ClusterCommandResponse,
    ClusterCreateRequest,
    ClusterDetailResponse,
    ClusterInitRequest,
    ClusterInitResponse,
    ClusterItem,
    ClusterListResponse,
    ClusterNodeItem,
    ClusterNodepoolItem,
    ClusterNodepoolListResponse,
    ClusterNodepoolRequest,
    ClusterResetNodesRequest,
    MetalLbConfig,
    validate_cluster_name,
)
from ..services.backup import create_safety_snapshot
from ..services.cluster_config import (
    build_deploy_steps,
    build_sync_steps,
    initialize_cluster_config,
    require_cluster_config,
    resolve_central_ip,
)
from ..services.mock_data import MOCK_CLUSTERS
from ..services.process_runner import ProcessRunner
from .audit import record_audit_event
from .auth import require_mutating_role

router = APIRouter(prefix="/api/v1/clusters", tags=["clusters"])

PIPELINE_STEPS = [
    "01-preprov-create-nkp-cluster-konvoy.sh",
    "02-preprov-bootstrap-cluster.sh",
    "03-preprov-install-cni.sh",
    "04-preprov-configure-metallb.sh",
    "05-preprov-validate-cluster.sh",
]

DEFAULT_NODEPOOLS = [
    {"name": "worker-pool-1", "replicas": 3},
    {"name": "worker-pool-2", "replicas": 2},
]
# Deterministic in-memory nodepool state keyed by cluster name.
NODEPOOL_STATE: dict[str, list[ClusterNodepoolItem]] = {}


def _cluster_nodepools(name: str) -> list[ClusterNodepoolItem]:
    if name not in NODEPOOL_STATE:
        NODEPOOL_STATE[name] = [ClusterNodepoolItem(**pool) for pool in DEFAULT_NODEPOOLS]
    return NODEPOOL_STATE[name]


def get_runner(request: Request) -> ProcessRunner:
    return request.app.state.process_runner


def _normalize_cluster_item(raw: dict[str, Any]) -> ClusterItem:
    status = str(raw.get("status", "unknown")).lower()
    if status not in {"ready", "deploying", "failed"}:
        status = "unknown"
    desired_nodes = int(raw.get("desired_nodes", 0))
    ready_nodes = int(raw.get("ready_nodes", 0))
    return ClusterItem(
        name=str(raw.get("name", "unknown")),
        status=status,  # type: ignore[arg-type]
        kubernetes_version=str(raw.get("kubernetes_version", "")),
        desired_nodes=desired_nodes,
        ready_nodes=ready_nodes,
        last_updated_at=raw.get("last_updated_at"),
        metallb=MetalLbConfig(
            vip_range=str(raw.get("metallb", {}).get("vip_range", "")),
            address_pool=str(raw.get("metallb", {}).get("address_pool", "")),
        ),
    )


def _normalize_cluster_node(raw: dict[str, Any]) -> ClusterNodeItem:
    role = str(raw.get("role", "unknown")).lower()
    if role not in {"control-plane", "worker"}:
        role = "unknown"
    status = str(raw.get("status", "unknown")).lower()
    if status not in {"ready", "notready"}:
        status = "unknown"
    return ClusterNodeItem(
        name=str(raw.get("name", "unknown")),
        role=role,  # type: ignore[arg-type]
        status=status,  # type: ignore[arg-type]
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
        detail = stderr.decode(errors="replace").strip() or "cluster command failed"
        raise HTTPException(status_code=500, detail=detail)
    try:
        payload = stdout.decode(errors="replace").strip()
        return json.loads(payload) if payload else []
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="forge cluster command returned invalid JSON") from exc


@router.get("", response_model=ClusterListResponse)
async def list_clusters(request: Request) -> ClusterListResponse:
    """Return NKP cluster inventory from forge CLI JSON output."""
    if get_settings().forge_mock_mode:
        payload: Union[dict[str, Any], list[dict[str, Any]]] = MOCK_CLUSTERS
    else:
        payload = await _run_forge_json(get_runner(request), ["cluster-list", "--json"])
    raw_clusters = payload["clusters"] if isinstance(payload, dict) else payload
    cluster_items = [_normalize_cluster_item(item) for item in raw_clusters if isinstance(item, dict)]
    return ClusterListResponse(clusters=cluster_items)


@router.post("/init-config", response_model=ClusterInitResponse, dependencies=[Depends(require_mutating_role)])
async def init_cluster_config(request: Request, payload: ClusterInitRequest) -> ClusterInitResponse:
    """Generate `<FORGE_STATE_DIR>/<cluster>/<cluster>-input.ini` for the guided deploy wizard.

    Discovers the lab (`<FORGE_HOME>/labs/<lab>/<lab>-infra.ini`, 404 when unknown), inherits its
    non-secret fields, pre-selects a free control-plane VIP and MetalLB range from IPAM and
    returns the file content plus the equivalent `./forge` commands. Records a
    `cluster-config-initialized` audit event. Requires the Operator or Admin role.
    """
    started = time.monotonic()
    result = await initialize_cluster_config(get_runner(request).forge_bin, payload)
    record_audit_event(
        run_id=f"cluster-init-{uuid4().hex[:8]}",
        verb="cluster-config-initialized",
        user="lab-operator",
        status="succeeded",
        duration_sec=round(time.monotonic() - started, 3),
        details={
            "cluster_name": payload.cluster_name,
            "lab_name": payload.lab_name,
            "nkp_version": payload.nkp_version,
            "target_runner": payload.target_runner,
            "hypervisor_type": payload.hypervisor_type,
            "config_path": result.config_path,
            "vip": result.vip_preview,
            "metallb_range": result.metallb_range_preview,
        },
    )
    return result


@router.post(
    "/sync-bastion",
    response_model=BastionSyncResponse,
    status_code=202,
    dependencies=[Depends(require_mutating_role)],
)
async def sync_bastion(request: Request, payload: BastionSyncRequest) -> BastionSyncResponse:
    """Stage the generated cluster config on a bastion and queue the run (SSE via `/api/v1/pipeline/{run_id}/stream`).

    `nfs_mount=true` runs `./forge share mount --from <central_ip> --target <bastion_ip>` (the
    bastion then sees `~/forge-state`); `nfs_mount=false` copies `<cluster>-input.ini` with ssh + scp.
    404 when `init-config` has not generated the cluster config yet. Records a
    `cluster-bastion-sync` audit event.
    """
    require_cluster_config(payload.cluster_name)
    central_ip = await resolve_central_ip(payload.bastion_ip) if payload.nfs_mount else ""
    steps = build_sync_steps(payload.cluster_name, payload.bastion_ip, central_ip, payload.nfs_mount)
    run = await get_runner(request).start_sequence(steps)
    record_audit_event(
        run_id=str(run.run_id),
        verb="cluster-bastion-sync",
        user="lab-operator",
        status="succeeded",
        duration_sec=0.0,
        details={
            "cluster_name": payload.cluster_name,
            "bastion_ip": payload.bastion_ip,
            "nfs_mount": payload.nfs_mount,
        },
    )
    return BastionSyncResponse(
        run_id=str(run.run_id),
        cluster_name=payload.cluster_name,
        bastion_ip=payload.bastion_ip,
        status="queued",
        steps=[step.display for step in steps],
    )


async def _create_from_wizard(request: Request, payload: ClusterCreateRequest) -> ClusterCommandResponse:
    """Chain `provision vms` + `create cluster` (on Central or the bastion) for a wizard-generated config."""
    try:
        cluster_name = validate_cluster_name(payload.cluster_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    require_cluster_config(cluster_name)
    central_ip = ""
    if payload.target_runner == "bastion" and payload.nfs_mount:
        central_ip = await resolve_central_ip(payload.bastion_ip or "")
    steps = build_deploy_steps(
        cluster_name,
        payload.target_runner,
        payload.bastion_ip,
        central_ip,
        nfs_mount=payload.nfs_mount,
        provision_vms=payload.provision_vms,
    )
    run = await get_runner(request).start_sequence(steps)
    record_audit_event(
        run_id=str(run.run_id),
        verb="cluster-create-dispatched",
        user="lab-operator",
        status="succeeded",
        duration_sec=0.0,
        details={
            "cluster_name": cluster_name,
            "lab_name": payload.lab_name,
            "target_runner": payload.target_runner,
            "bastion_ip": payload.bastion_ip,
            "hypervisor_type": payload.hypervisor_type,
        },
    )
    return ClusterCommandResponse(
        run_id=run.run_id,
        status=run.status.value,
        command=run.command,
        started_at=run.started_at,
        steps=[step.label for step in steps],
    )


@router.post(
    "/create",
    response_model=ClusterCommandResponse,
    status_code=202,
    dependencies=[Depends(require_mutating_role)],
)
async def create_cluster(request: Request, payload: ClusterCreateRequest) -> ClusterCommandResponse:
    """Queue NKP cluster creation with live SSE progress (`/api/v1/pipeline/{run_id}/stream`).

    With `lab_name` (guided wizard) the run chains `./forge provision vms` and
    `./forge create cluster` against the `<cluster>-input.ini` produced by `init-config`; for
    `target_runner=bastion` it first stages the config (NFS mount or scp) and runs both commands
    on the bastion over SSH. Without `lab_name` the legacy 01-05 preprovisioned pipeline is queued.
    """
    if payload.lab_name:
        return await _create_from_wizard(request, payload)
    runner = get_runner(request)
    args = [
        "cluster-create",
        "--cluster-name",
        payload.cluster_name,
        "--control-plane-nodes",
        str(payload.control_plane_nodes),
        "--worker-nodes",
        str(payload.worker_nodes),
        "--kubernetes-version",
        payload.kubernetes_version,
        "--hypervisor-type",
        payload.hypervisor_type,
    ]
    for step_name in PIPELINE_STEPS:
        args.extend(["--pipeline-step", step_name])
    run = await runner.start_run(command="forge", args=args)
    return ClusterCommandResponse(
        run_id=run.run_id,
        status=run.status.value,
        command=run.command,
        started_at=run.started_at,
    )


@router.get("/{name}", response_model=ClusterDetailResponse)
async def get_cluster(name: str, request: Request) -> ClusterDetailResponse:
    """Return detailed cluster state including nodes and MetalLB VIP config."""
    runner = get_runner(request)
    payload = await _run_forge_json(runner, ["cluster-get", "--name", name, "--json"])
    if not isinstance(payload, dict):
        raise HTTPException(status_code=500, detail="cluster detail payload format is invalid")
    cluster_raw = payload.get("cluster")
    if not isinstance(cluster_raw, dict):
        raise HTTPException(status_code=404, detail=f"cluster not found: {name}")
    nodes_raw = payload.get("nodes", [])
    nodes = [_normalize_cluster_node(item) for item in nodes_raw if isinstance(item, dict)]
    return ClusterDetailResponse(
        cluster=_normalize_cluster_item(cluster_raw),
        nodes=nodes,
    )


@router.delete(
    "/{name}",
    response_model=ClusterCommandResponse,
    status_code=202,
    dependencies=[Depends(require_mutating_role)],
)
async def delete_cluster(name: str, request: Request) -> ClusterCommandResponse:
    """Queue cluster deletion after taking an automatic pre-mutation safety snapshot."""
    runner = get_runner(request)
    snapshot = create_safety_snapshot("cluster-delete", name)
    run = await runner.start_run(
        command="forge",
        args=["cluster-delete", "--cluster-name", name],
    )
    return ClusterCommandResponse(
        run_id=run.run_id,
        status=run.status.value,
        command=run.command,
        started_at=run.started_at,
        safety_backup_id=snapshot.backup_id,
    )


@router.post("/{name}/nodepools", response_model=ClusterCommandResponse, status_code=202)
async def create_or_scale_nodepool(
    name: str, request: Request, payload: ClusterNodepoolRequest
) -> ClusterCommandResponse:
    """Queue preprovisioned nodepool creation or scale-up request."""
    runner = get_runner(request)
    pools = _cluster_nodepools(name)
    existing = next((pool for pool in pools if pool.name == payload.nodepool_name), None)
    if existing:
        existing.replicas = payload.replicas
        existing.hypervisor_type = payload.hypervisor_type
    else:
        pools.append(
            ClusterNodepoolItem(
                name=payload.nodepool_name,
                replicas=payload.replicas,
                hypervisor_type=payload.hypervisor_type,
            )
        )
    run = await runner.start_run(
        command="forge",
        args=[
            "preprov-create-nodepool.sh",
            "--cluster-name",
            name,
            "--nodepool-name",
            payload.nodepool_name,
            "--replicas",
            str(payload.replicas),
            "--hypervisor-type",
            payload.hypervisor_type,
        ],
    )
    return ClusterCommandResponse(
        run_id=run.run_id,
        status=run.status.value,
        command=run.command,
        started_at=run.started_at,
    )


@router.get("/{name}/nodepools", response_model=ClusterNodepoolListResponse)
async def list_nodepools(name: str) -> ClusterNodepoolListResponse:
    """Return nodepools for a cluster (seeded defaults plus any created or scaled pools)."""
    return ClusterNodepoolListResponse(nodepools=_cluster_nodepools(name))


@router.post(
    "/{name}/reset-nodes",
    response_model=ClusterCommandResponse,
    status_code=202,
    dependencies=[Depends(require_mutating_role)],
)
async def reset_cluster_nodes(
    name: str, request: Request, payload: Optional[ClusterResetNodesRequest] = None
) -> ClusterCommandResponse:
    """Take a safety snapshot, queue preprov-reset-nodes.sh and record an audit trail entry."""
    runner = get_runner(request)
    snapshot = create_safety_snapshot("reset-nodes", name)
    args = ["preprov-reset-nodes.sh", "--cluster-name", name]
    for node_name in (payload.node_names if payload and payload.node_names else []):
        args.extend(["--node-name", node_name])
    run = await runner.start_run(command="forge", args=args)
    record_audit_event(
        run_id=str(run.run_id),
        verb="cluster-reset-nodes",
        user="lab-operator",
        status="succeeded",
        duration_sec=15.2,
        details={"cluster_name": name},
    )
    return ClusterCommandResponse(
        run_id=run.run_id,
        status=run.status.value,
        command=run.command,
        started_at=run.started_at,
        safety_backup_id=snapshot.backup_id,
    )
