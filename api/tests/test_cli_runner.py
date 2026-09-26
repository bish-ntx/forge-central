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
async def test_health_endpoint_returns_expected_payload() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    assert "forge_bin" in payload


@pytest.mark.asyncio
async def test_version_endpoint_returns_control_plane_and_forge_versions(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_version() -> str:
        return "forge v0.1.0"

    monkeypatch.setattr(app.state.process_runner, "get_forge_version", fake_version)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/version")

    assert response.status_code == 200
    payload = response.json()
    assert payload["control_plane_version"] == "1.0.0"
    assert payload["forge_version"] == "forge v0.1.0"


@pytest.mark.asyncio
async def test_cli_execute_endpoint_accepts_command_string(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_start_run(command: str | list[str], args: list[str], env_overrides: dict[str, str]) -> ProcessRun:
        _ = (command, args, env_overrides)
        return ProcessRun(
            run_id=uuid4(),
            command="./forge provision vms --dry-run",
            argv=["provision", "vms", "--dry-run"],
            status=RunStatus.PENDING,
            started_at=datetime.now(timezone.utc),
        )

    monkeypatch.setattr(app.state.process_runner, "start_run", fake_start_run)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/cli/execute",
            json={
                "command": "provision vms",
                "args": ["--dry-run"],
                "env_overrides": {"FORGE_ENV": "test"},
            },
        )

    assert response.status_code == 202
    payload = response.json()
    assert payload["status"] == "PENDING"
    assert "run_id" in payload
    assert payload["command"].startswith("./forge") or "forge" in payload["command"]
