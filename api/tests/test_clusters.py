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
