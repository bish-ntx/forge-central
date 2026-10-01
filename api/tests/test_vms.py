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


@pytest.mark.asyncio
async def test_list_vms_supports_status_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_run_forge_json(_runner, _argv):
        return {
            "vms": [
                {
                    "vmid": 100,
                    "name": "gpu-worker-01",
                    "node": "pve-a",
                    "cores": 8,
                    "memory_mb": 16384,
                    "disk_gb": 200,
                    "status": "running",
                    "gpu_passthrough": True,
                    "pci_devices": ["0000:65:00.0"],
                },
                {
                    "vmid": 101,
                    "name": "db-node-01",
                    "node": "pve-b",
                    "cores": 4,
                    "memory_mb": 8192,
                    "disk_gb": 80,
                    "status": "stopped",
                    "gpu_passthrough": False,
                    "pci_devices": [],
                },
            ]
        }

    monkeypatch.setattr("api.app.routers.vms._run_forge_json", fake_run_forge_json)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/vms?status=running")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["vms"]) == 1
    assert payload["vms"][0]["name"] == "gpu-worker-01"
    assert payload["vms"][0]["gpu_passthrough"] is True


def _pending_run(command: str) -> ProcessRun:
    return ProcessRun(
        run_id=uuid4(),
        command=command,
        argv=command.split(),
        status=RunStatus.PENDING,
        started_at=datetime.now(timezone.utc),
    )


@pytest.mark.asyncio
async def test_create_vm_queues_forge_run(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    async def fake_start_run(command: str | list[str], args: list[str], env_overrides=None) -> ProcessRun:
        captured["command"] = command
        captured["args"] = args
        captured["env_overrides"] = env_overrides
        return _pending_run("./forge vm-create --name vm-01")

    monkeypatch.setattr(app.state.process_runner, "start_run", fake_start_run)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/vms/create",
            json={
                "name": "vm-01",
                "node": "pve-a",
                "cores": 4,
                "memory_mb": 4096,
                "disk_gb": 60,
                "hypervisor_type": "proxmox",
            },
        )

    assert response.status_code == 202
    assert captured["command"] == "forge"
    assert "--hypervisor-type" in captured["args"]
    assert "proxmox" in captured["args"]


@pytest.mark.asyncio
async def test_vm_action_endpoint_queues_requested_action(monkeypatch: pytest.MonkeyPatch) -> None:
    captured_args: list[str] = []

    async def fake_start_run(command: str | list[str], args: list[str], env_overrides=None) -> ProcessRun:
        _ = (command, env_overrides)
        captured_args.extend(args)
        return _pending_run("./forge vm-action --vmid 200 --action restart")

    monkeypatch.setattr(app.state.process_runner, "start_run", fake_start_run)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/vms/200/action", json={"action": "restart"})

    assert response.status_code == 202
    assert captured_args == ["vm-action", "--vmid", "200", "--action", "restart"]


@pytest.mark.asyncio
async def test_vm_batch_action_queues_runner(monkeypatch: pytest.MonkeyPatch) -> None:
    captured_args: list[str] = []

    async def fake_start_run(command: str | list[str], args: list[str], env_overrides=None) -> ProcessRun:
        _ = (command, env_overrides)
        captured_args.extend(args)
        return _pending_run("./forge vm-batch-action --action stop --vmids 101,102")

    monkeypatch.setattr(app.state.process_runner, "start_run", fake_start_run)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/vms/batch-action", json={"vmids": [101, 102], "action": "stop"}
        )

    assert response.status_code == 202
    payload = response.json()
    assert payload["affected_vmids"] == [101, 102]
    assert payload["action"] == "stop"
    assert captured_args == ["vm-batch-action", "--action", "stop", "--vmids", "101,102"]


@pytest.mark.asyncio
async def test_vm_clone_batch_queues_runner(monkeypatch: pytest.MonkeyPatch) -> None:
    captured_args: list[str] = []

    async def fake_start_run(command: str | list[str], args: list[str], env_overrides=None) -> ProcessRun:
        _ = (command, env_overrides)
        captured_args.extend(args)
        return _pending_run("./forge vm-clone-batch --template-id 9000")

    monkeypatch.setattr(app.state.process_runner, "start_run", fake_start_run)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/vms/clone-batch",
            json={"template_id": 9000, "count": 3, "base_name": "worker"},
        )

    assert response.status_code == 202
    assert response.json()["created_vms"] == []
    assert captured_args == [
        "vm-clone-batch", "--template-id", "9000", "--count", "3",
        "--base-name", "worker", "--node", "pve-a",
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(("action", "expects_snapshot"), [("destroy", True), ("stop", False)])
async def test_vm_batch_action_safety_snapshot_only_for_destroy(
    monkeypatch: pytest.MonkeyPatch, isolated_backup_dir: Path, action: str, expects_snapshot: bool
) -> None:
    async def fake_start_run(command: str | list[str], args: list[str], env_overrides=None) -> ProcessRun:
        _ = (command, args, env_overrides)
        return _pending_run("./forge vm-batch-action")

    monkeypatch.setattr(app.state.process_runner, "start_run", fake_start_run)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/vms/batch-action", json={"vmids": [101, 102], "action": action}
        )

    assert response.status_code == 202
    backup_id = response.json()["safety_backup_id"]
    if expects_snapshot:
        assert backup_id.startswith("safety-vm-batch-destroy-2-vms-")
        assert (isolated_backup_dir / f"{backup_id}.tar.gz").is_file()
    else:
        assert backup_id is None
        assert not isolated_backup_dir.exists()
