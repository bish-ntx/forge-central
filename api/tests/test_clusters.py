from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import sys
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.main import app
from api.app.services.process_runner import ProcessRun, RunStatus


def _pending_run(command: str) -> ProcessRun:
    return ProcessRun(
        run_id=uuid4(),
        command=command,
        argv=command.split(),
        status=RunStatus.PENDING,
        started_at=datetime.now(timezone.utc),
    )


def test_cluster_requests_default_to_four_workers() -> None:
    from api.app.schemas.clusters import ClusterCreateRequest, ClusterInitRequest

    assert ClusterCreateRequest(cluster_name="nkp-prod-01").worker_nodes == 4
    init = ClusterInitRequest(cluster_name="nkp-prod-01", lab_name="amd-lab", nkp_version="v2.18.0")
    assert init.worker_nodes == 4


@pytest.mark.asyncio
async def test_list_clusters_returns_normalized_items(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_run_forge_json(_runner, _argv):
        return {
            "clusters": [
                {
                    "name": "nkp-prod-01",
                    "status": "ready",
                    "kubernetes_version": "v1.31.1",
                    "desired_nodes": 6,
                    "ready_nodes": 5,
                    "metallb": {
                        "vip_range": "10.10.40.100-10.10.40.120",
                        "address_pool": "nkp-prod-pool",
                    },
                }
            ]
        }

    monkeypatch.setattr("api.app.routers.clusters._run_forge_json", fake_run_forge_json)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/clusters")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["clusters"]) == 1
    assert payload["clusters"][0]["name"] == "nkp-prod-01"
    assert payload["clusters"][0]["metallb"]["vip_range"] == "10.10.40.100-10.10.40.120"


@pytest.mark.asyncio
async def test_create_cluster_queues_pipeline_steps(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    async def fake_start_run(command: str | list[str], args: list[str], env_overrides=None) -> ProcessRun:
        captured["command"] = command
        captured["args"] = args
        captured["env_overrides"] = env_overrides
        return _pending_run("./forge cluster-create --cluster-name nkp-qa-01")

    monkeypatch.setattr(app.state.process_runner, "start_run", fake_start_run)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/clusters/create",
            json={
                "cluster_name": "nkp-qa-01",
                "control_plane_nodes": 3,
                "worker_nodes": 4,
                "kubernetes_version": "v1.31.1",
                "hypervisor_type": "proxmox",
            },
        )

    assert response.status_code == 202
    args = captured["args"]
    assert captured["command"] == "forge"
    assert "--pipeline-step" in args
    assert "01-preprov-create-nkp-cluster-konvoy.sh" in args
    assert "05-preprov-validate-cluster.sh" in args


@pytest.mark.asyncio
async def test_delete_cluster_queues_delete_run(monkeypatch: pytest.MonkeyPatch) -> None:
    captured_args: list[str] = []

    async def fake_start_run(command: str | list[str], args: list[str], env_overrides=None) -> ProcessRun:
        _ = (command, env_overrides)
        captured_args.extend(args)
        return _pending_run("./forge cluster-delete --cluster-name nkp-prod-01")

    monkeypatch.setattr(app.state.process_runner, "start_run", fake_start_run)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.delete("/api/v1/clusters/nkp-prod-01")

    assert response.status_code == 202
    assert captured_args == ["cluster-delete", "--cluster-name", "nkp-prod-01"]


@pytest.mark.asyncio
async def test_reset_nodes_queues_run_and_logs_audit(monkeypatch: pytest.MonkeyPatch) -> None:
    captured_args: list[str] = []

    async def fake_start_run(command: str | list[str], args: list[str], env_overrides=None) -> ProcessRun:
        _ = (command, env_overrides)
        captured_args.extend(args)
        return _pending_run("./forge preprov-reset-nodes.sh")

    monkeypatch.setattr(app.state.process_runner, "start_run", fake_start_run)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/clusters/amd-nkp1/reset-nodes")
        logs = await client.get("/api/v1/audit/logs", params={"verb": "cluster-reset-nodes"})

    assert response.status_code == 202
    assert captured_args == ["preprov-reset-nodes.sh", "--cluster-name", "amd-nkp1"]
    entries = logs.json()["logs"]
    assert entries[0]["run_id"] == response.json()["run_id"]
    assert entries[0]["details"] == {"cluster_name": "amd-nkp1"}


@pytest.mark.asyncio
async def test_list_nodepools_reflects_created_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_start_run(command: str | list[str], args: list[str], env_overrides=None) -> ProcessRun:
        _ = (command, args, env_overrides)
        return _pending_run("./forge preprov-create-nodepool.sh")

    monkeypatch.setattr(app.state.process_runner, "start_run", fake_start_run)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        initial = await client.get("/api/v1/clusters/np-test/nodepools")
        await client.post(
            "/api/v1/clusters/np-test/nodepools",
            json={"nodepool_name": "gpu-pool", "replicas": 4, "hypervisor_type": "ahv"},
        )
        updated = await client.get("/api/v1/clusters/np-test/nodepools")

    assert initial.status_code == 200
    assert [p["name"] for p in initial.json()["nodepools"]] == ["worker-pool-1", "worker-pool-2"]
    assert initial.json()["nodepools"][0]["replicas"] == 3
    pools = {p["name"]: p for p in updated.json()["nodepools"]}
    assert pools["gpu-pool"]["replicas"] == 4
    assert pools["gpu-pool"]["hypervisor_type"] == "ahv"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "path", "operation"),
    [
        ("delete", "/api/v1/clusters/nkp-prod-01", "cluster-delete"),
        ("post", "/api/v1/clusters/amd-nkp1/reset-nodes", "reset-nodes"),
    ],
)
async def test_destructive_cluster_ops_create_safety_snapshot(
    monkeypatch: pytest.MonkeyPatch, isolated_backup_dir: Path, method: str, path: str, operation: str
) -> None:
    async def fake_start_run(command: str | list[str], args: list[str], env_overrides=None) -> ProcessRun:
        _ = (command, args, env_overrides)
        return _pending_run("./forge destructive")

    monkeypatch.setattr(app.state.process_runner, "start_run", fake_start_run)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.request(method, path)
        logs = await client.get("/api/v1/audit/logs", params={"verb": "safety-snapshot-created"})

    assert response.status_code == 202
    backup_id = response.json()["safety_backup_id"]
    assert backup_id.startswith(f"safety-{operation}-")
    assert (isolated_backup_dir / f"{backup_id}.tar.gz").is_file()
    assert (isolated_backup_dir / f"{backup_id}.tar.gz.sha256").is_file()
    assert logs.json()["logs"][0]["details"]["operation_name"] == operation
