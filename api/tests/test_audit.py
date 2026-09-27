from __future__ import annotations

from pathlib import Path
import sys

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.main import app
from api.app.routers.audit import record_audit_event, reset_audit_logs_for_tests


@pytest.mark.asyncio
async def test_get_audit_logs_returns_entries_and_count() -> None:
    reset_audit_logs_for_tests()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/audit/logs")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_count"] >= 3
    assert len(payload["logs"]) == payload["total_count"]


@pytest.mark.asyncio
async def test_get_audit_logs_filters_by_status() -> None:
    reset_audit_logs_for_tests()
    record_audit_event(
        run_id="run-manual-fail-01",
        verb="diagnostics-capture",
        user="qa-user",
        status="failed",
        duration_sec=3.2,
        details={"cluster_name": "qa-cluster"},
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/audit/logs?status=failed")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_count"] >= 1
    assert all(log["status"] == "failed" for log in payload["logs"])


@pytest.mark.asyncio
async def test_get_audit_logs_filters_by_verb() -> None:
    reset_audit_logs_for_tests()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/audit/logs?verb=diagnostics-capture")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_count"] >= 1
    assert all(log["verb"] == "diagnostics-capture" for log in payload["logs"])
