from __future__ import annotations

from pathlib import Path
import sys

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.config import get_settings
from api.app.main import app


@pytest.fixture
def mock_mode(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("FORGE_MOCK_MODE", "true")
    get_settings.cache_clear()
    yield
    monkeypatch.undo()
    get_settings.cache_clear()


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_health_reports_mock_mode_flag(mock_mode) -> None:
    async with _client() as client:
        payload = (await client.get("/health")).json()
    assert payload["mock_mode"] is True


@pytest.mark.asyncio
async def test_health_mock_mode_defaults_false(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FORGE_MOCK_MODE", raising=False)
    get_settings.cache_clear()
    async with _client() as client:
        payload = (await client.get("/health")).json()
    get_settings.cache_clear()
    assert payload["mock_mode"] is False


@pytest.mark.asyncio
async def test_mock_run_streams_synthetic_logs_without_forge(mock_mode, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fail_spawn(*_args, **_kwargs):
        raise AssertionError("./forge must not be spawned in mock mode")

    monkeypatch.setattr("asyncio.create_subprocess_exec", fail_spawn)
    runner = app.state.process_runner
    run = await runner.start_run(command="forge", args=["provision", "vms"])

    events = [event async for event in app.state.log_publisher.subscribe(run.run_id)]

    logs = [e["data"]["line"] for e in events if e["event"] == "log"]
    assert any("Stage 1/5" in line for line in logs)
    assert any("etcd" in line for line in logs)
    assert any(e["data"]["stream"] == "stderr" for e in events if e["event"] == "log")
    assert events[-1] == {"event": "end", "data": {"exit_code": 0, "status": "COMPLETED"}}
    assert run.exit_code == 0
    assert run.status.value == "COMPLETED"


@pytest.mark.asyncio
async def test_missing_forge_binary_falls_back_to_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FORGE_MOCK_MODE", raising=False)
    get_settings.cache_clear()
    runner = app.state.process_runner
    monkeypatch.setattr(runner, "_forge_bin", Path("/nonexistent/forge"))
    run = await runner.start_run(command="forge", args=["provision"])
    events = [event async for event in app.state.log_publisher.subscribe(run.run_id)]
    get_settings.cache_clear()
    assert events[-1]["event"] == "end"
    assert events[-1]["data"]["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_mock_vms_clusters_and_shares(mock_mode) -> None:
    async with _client() as client:
        vms = (await client.get("/api/v1/vms")).json()["vms"]
        clusters = (await client.get("/api/v1/clusters")).json()["clusters"]
        shares = (await client.get("/api/v1/shares/status")).json()["shares"]

    assert [vm["name"] for vm in vms] == ["cp-01", "cp-02", "cp-03", "wk-01", "wk-02", "gpu-01"]
    gpu = vms[-1]
    assert gpu["gpu_passthrough"] is True and gpu["pci_devices"]
    assert {c["name"]: c["status"] for c in clusters} == {"amd-nkp1": "ready", "cirra-nkp1": "deploying"}
    assert [s["export"] for s in shares] == ["~/nkp-forge", "~/forge-state", "~/cacrt"]
