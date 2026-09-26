from __future__ import annotations

import asyncio
import json
from typing import Any, Union

from fastapi import APIRouter, HTTPException, Request

from ..schemas.clusters import (
    ClusterCommandResponse,
    ClusterCreateRequest,
    ClusterDetailResponse,
    ClusterItem,
    ClusterListResponse,
    ClusterNodeItem,
    ClusterNodepoolRequest,
    MetalLbConfig,
)
from ..services.process_runner import ProcessRunner

router = APIRouter(prefix="/api/v1/clusters", tags=["clusters"])

PIPELINE_STEPS = [
    "01-preprov-create-nkp-cluster-konvoy.sh",
    "02-preprov-bootstrap-cluster.sh",
    "03-preprov-install-cni.sh",
    "04-preprov-configure-metallb.sh",
    "05-preprov-validate-cluster.sh",
]


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
    runner = get_runner(request)
    payload = await _run_forge_json(runner, ["cluster-list", "--json"])
    raw_clusters = payload["clusters"] if isinstance(payload, dict) else payload
    cluster_items = [_normalize_cluster_item(item) for item in raw_clusters if isinstance(item, dict)]
    return ClusterListResponse(clusters=cluster_items)


@router.post("/create", response_model=ClusterCommandResponse, status_code=202)
async def create_cluster(request: Request, payload: ClusterCreateRequest) -> ClusterCommandResponse:
    """Queue 01-05 preprovisioned NKP cluster creation workflow."""
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


@router.delete("/{name}", response_model=ClusterCommandResponse, status_code=202)
async def delete_cluster(name: str, request: Request) -> ClusterCommandResponse:
    """Queue cluster deletion for NKP workload or management cluster."""
    runner = get_runner(request)
    run = await runner.start_run(
        command="forge",
        args=["cluster-delete", "--cluster-name", name],
    )
    return ClusterCommandResponse(
        run_id=run.run_id,
        status=run.status.value,
        command=run.command,
        started_at=run.started_at,
    )


@router.post("/{name}/nodepools", response_model=ClusterCommandResponse, status_code=202)
async def create_or_scale_nodepool(
    name: str, request: Request, payload: ClusterNodepoolRequest
) -> ClusterCommandResponse:
    """Queue preprovisioned nodepool creation or scale-up request."""
    runner = get_runner(request)
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
