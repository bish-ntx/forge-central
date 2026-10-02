from __future__ import annotations

import json
from pathlib import Path
import sys

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.config import get_settings
from api.app.main import app
from api.app.routers import audit as audit_router


@pytest.fixture(autouse=True)
def telemetry_env(tmp_path, monkeypatch):
    """Isolated FORGE_DATA_DIR + offline mock clusters (amd-nkp1, cirra-nkp1)."""
    monkeypatch.setenv("FORGE_DATA_DIR", str(tmp_path / "forge-data"))
    monkeypatch.setenv("FORGE_MOCK_MODE", "1")
    monkeypatch.delenv("FORGE_OTEL_ENABLED", raising=False)
    monkeypatch.delenv("FORGE_OTEL_COLLECTOR_URL", raising=False)
    get_settings.cache_clear()
    audit_router.reset_audit_logs_for_tests()
    yield tmp_path / "forge-data"
    get_settings.cache_clear()


def _run(cluster: str, **overrides):
    payload = {
        "cluster_name": cluster,
        "run_id": "day2-001",
        "suite_name": "nkpday2-gpu",
        "passed": 40,
        "failed": 0,
        "duration_seconds": 312.5,
        "status": "passed",
        "tags": {"repo": "nkpday2"},
    }
    payload.update(overrides)
    return payload


async def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_ingest_persists_run_and_records_audit_event(telemetry_env) -> None:
    async with await _client() as client:
        response = await client.post("/api/v1/telemetry/ingest/test-run", json=_run("amd-nkp1"))
        runs = await client.get("/api/v1/telemetry/runs")
        audit = await client.get("/api/v1/audit/logs", params={"verb": "telemetry-ingested"})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "accepted"
    assert body["cluster_name"] == "amd-nkp1"
    assert body["ingestion_id"].startswith("ing-")

    stored = json.loads((telemetry_env / "telemetry" / "test-runs.json").read_text())
    assert len(stored) == 1 and stored[0]["ingestion_id"] == body["ingestion_id"]

    listed = runs.json()
    assert listed["total_count"] == 1
    assert listed["runs"][0]["suite_name"] == "nkpday2-gpu"
    assert listed["runs"][0]["skipped"] == 0
    assert audit.json()["total_count"] == 1
    assert audit.json()["logs"][0]["details"]["cluster_name"] == "amd-nkp1"


@pytest.mark.asyncio
async def test_runs_filter_by_cluster_name() -> None:
    async with await _client() as client:
        await client.post("/api/v1/telemetry/ingest/test-run", json=_run("amd-nkp1"))
        await client.post("/api/v1/telemetry/ingest/test-run", json=_run("cirra-nkp1", suite_name="nkpday2-csi"))
        filtered = await client.get("/api/v1/telemetry/runs", params={"cluster_name": "cirra-nkp1"})

    runs = filtered.json()["runs"]
    assert [run["cluster_name"] for run in runs] == ["cirra-nkp1"]
    assert runs[0]["suite_name"] == "nkpday2-csi"


@pytest.mark.asyncio
async def test_correlation_untested_when_no_runs() -> None:
    async with await _client() as client:
        response = await client.get("/api/v1/telemetry/correlation")

    payload = response.json()
    assert response.status_code == 200
    assert {c["cluster_name"] for c in payload["clusters"]} == {"amd-nkp1", "cirra-nkp1"}
    assert all(c["qualification_status"] == "untested" for c in payload["clusters"])
    assert payload["total_untested"] == 2
    assert payload["total_qualified"] == 0 and payload["total_failing"] == 0


@pytest.mark.asyncio
async def test_correlation_qualified_and_failing_use_latest_run() -> None:
    async with await _client() as client:
        # amd-nkp1: failing run first, then a newer passing run -> qualified
        await client.post(
            "/api/v1/telemetry/ingest/test-run",
            json=_run("amd-nkp1", failed=3, status="failed", executed_at="2026-09-30T10:00:00Z"),
        )
        await client.post(
            "/api/v1/telemetry/ingest/test-run",
            json=_run("amd-nkp1", run_id="day2-002", executed_at="2026-10-01T10:00:00Z"),
        )
        # cirra-nkp1: zero failures but error status -> failing
        await client.post(
            "/api/v1/telemetry/ingest/test-run",
            json=_run("cirra-nkp1", status="error", suite_name="nkpday2-csi"),
        )
        response = await client.get("/api/v1/telemetry/correlation")

    payload = response.json()
    by_name = {c["cluster_name"]: c for c in payload["clusters"]}
    assert by_name["amd-nkp1"]["qualification_status"] == "qualified"
    assert by_name["amd-nkp1"]["passed"] == 40 and by_name["amd-nkp1"]["failed"] == 0
    assert by_name["amd-nkp1"]["latest_suite"] == "nkpday2-gpu"
    assert by_name["amd-nkp1"]["last_tested_at"] == "2026-10-01T10:00:00Z"
    assert by_name["amd-nkp1"]["k8s_version"] == "v1.32.3"
    assert by_name["cirra-nkp1"]["qualification_status"] == "failing"
    assert (payload["total_qualified"], payload["total_failing"], payload["total_untested"]) == (1, 1, 0)


@pytest.mark.asyncio
async def test_correlation_failures_with_pass_status_is_failing() -> None:
    async with await _client() as client:
        await client.post("/api/v1/telemetry/ingest/test-run", json=_run("amd-nkp1", failed=2))
        response = await client.get("/api/v1/telemetry/correlation")

    by_name = {c["cluster_name"]: c for c in response.json()["clusters"]}
    assert by_name["amd-nkp1"]["qualification_status"] == "failing"


@pytest.mark.asyncio
async def test_status_reports_disabled_default_and_buffer_depth() -> None:
    async with await _client() as client:
        empty = await client.get("/api/v1/telemetry/status")
        await client.post("/api/v1/telemetry/ingest/test-run", json=_run("amd-nkp1"))
        after = await client.get("/api/v1/telemetry/status")

    assert empty.status_code == 200
    assert empty.json() == {
        "enabled": False,
        "collector_url": "http://localhost:4318",
        "buffered_count": 0,
        "last_export_at": None,
        "status": "disabled",
    }
    assert after.json()["buffered_count"] == 1


@pytest.mark.asyncio
async def test_status_enabled_from_environment(monkeypatch) -> None:
    monkeypatch.setenv("FORGE_OTEL_ENABLED", "true")
    monkeypatch.setenv("FORGE_OTEL_COLLECTOR_URL", "http://otel.lab:4318")
    get_settings.cache_clear()
    async with await _client() as client:
        response = await client.get("/api/v1/telemetry/status")

    assert response.json()["enabled"] is True
    assert response.json()["collector_url"] == "http://otel.lab:4318"
    assert response.json()["status"] == "buffering"


@pytest.mark.asyncio
async def test_timestamps_serialize_as_utc_z() -> None:
    async with await _client() as client:
        ingest = await client.post(
            "/api/v1/telemetry/ingest/test-run",
            json=_run("amd-nkp1", executed_at="2026-10-01T03:00:00-07:00"),
        )
        runs = await client.get("/api/v1/telemetry/runs")

    assert ingest.json()["received_at"].endswith("Z")
    run = runs.json()["runs"][0]
    assert run["executed_at"] == "2026-10-01T10:00:00Z"
    assert run["received_at"].endswith("Z")


@pytest.mark.asyncio
async def test_ingest_rejects_negative_counts() -> None:
    async with await _client() as client:
        response = await client.post("/api/v1/telemetry/ingest/test-run", json=_run("amd-nkp1", passed=-1))

    assert response.status_code == 422
