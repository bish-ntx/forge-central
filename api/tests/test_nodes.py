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


def _capture_runs(monkeypatch: pytest.MonkeyPatch, captured: dict[str, object]) -> None:
    async def fake_start_run(command, args, env_overrides=None) -> ProcessRun:
        captured["command"] = command
        captured["args"] = args
        return _pending_run("./forge " + " ".join(args))

    monkeypatch.setattr(app.state.process_runner, "start_run", fake_start_run)


@pytest.mark.asyncio
async def test_prep_node_builds_args_and_audits(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    _capture_runs(monkeypatch, captured)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/nodes/prep",
            json={
                "address": "10.10.0.21",
                "ssh_user": "nutanix",
                "conf": "lab-config.ini",
                "node_type": "gpu-wk",
                "target_type": "baremetal",
                "admin_key": "~/.ssh/id_rsa.pub",
                "dry_run": True,
            },
        )
        audit = await client.get("/api/v1/audit/logs", params={"verb": "node-prep-dispatched"})

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == RunStatus.PENDING.value
    assert body["command"].startswith("./forge prep node")
    assert captured["command"] == "forge"
    assert captured["args"] == [
        "prep",
        "node",
        "--address",
        "10.10.0.21",
        "--ssh-user",
        "nutanix",
        "--conf",
        "lab-config.ini",
        "--node-type",
        "gpu-wk",
        "--target-type",
        "baremetal",
        "--admin-key",
        "~/.ssh/id_rsa.pub",
        "--dry-run",
    ]
    entry = audit.json()["logs"][0]
    assert entry["details"]["target"] == "10.10.0.21"
    assert entry["details"]["dry_run"] is True


@pytest.mark.asyncio
async def test_prep_node_defaults_and_validation(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    _capture_runs(monkeypatch, captured)
    payload = {"address": "node-1", "ssh_user": "root", "conf": "lab.ini", "node_type": "wk"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ok = await client.post("/api/v1/nodes/prep", json=payload)
        bad = await client.post("/api/v1/nodes/prep", json={**payload, "node_type": "bogus"})

    assert ok.status_code == 202
    assert captured["args"][-2:] == ["--target-type", "vm"]
    assert "--dry-run" not in captured["args"]
    assert "--admin-key" not in captured["args"]
    assert bad.status_code == 422


@pytest.mark.asyncio
async def test_share_mount_builds_flags(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    _capture_runs(monkeypatch, captured)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        full = await client.post(
            "/api/v1/shares/mount",
            json={
                "from_ip": "10.10.0.5",
                "path": "/srv/forge-share",
                "target_bastion": "bastion-01",
                "reboot": True,
                "dry_run": True,
            },
        )
        full_args = captured["args"]
        minimal = await client.post("/api/v1/shares/mount", json={"from_ip": "10.10.0.5"})
        audit = await client.get("/api/v1/audit/logs", params={"verb": "share-mount-dispatched"})

    assert full.status_code == 202
    assert full_args == [
        "share",
        "mount",
        "--from-ip",
        "10.10.0.5",
        "--path",
        "/srv/forge-share",
        "--target-bastion",
        "bastion-01",
        "--reboot",
        "--dry-run",
    ]
    assert minimal.status_code == 202
    assert captured["args"] == ["share", "mount", "--from-ip", "10.10.0.5"]
    assert full.json()["command"].startswith("./forge share mount")
    assert len(audit.json()["logs"]) >= 2


@pytest.mark.asyncio
async def test_share_status_lists_shares() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/shares/status")

    assert response.status_code == 200
    shares = response.json()["shares"]
    assert len(shares) >= 1
    assert {"export", "status"} <= set(shares[0])
