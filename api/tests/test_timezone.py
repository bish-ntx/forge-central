from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.config import get_settings
from api.app.main import app
from api.app.schemas.audit import AuditLogEntry
from api.app.timeutil import dual_timestamp_header, iso_utc

ISO_Z = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def test_iso_utc_normalizes_offsets_and_naive_values() -> None:
    pacific = timezone(timedelta(hours=-7))
    assert iso_utc(datetime(2026, 9, 30, 18, 15, 30, tzinfo=pacific)) == "2026-10-01T01:15:30Z"
    assert iso_utc(datetime(2026, 10, 1, 1, 15, 30)) == "2026-10-01T01:15:30Z"
    assert ISO_Z.match(iso_utc())


def test_schema_serializes_utc_z_suffix() -> None:
    entry = AuditLogEntry(
        run_id="r1",
        timestamp="2026-09-30T18:15:30-07:00",
        verb="v",
        user="u",
        status="succeeded",
        duration_sec=1.0,
    )
    assert entry.timestamp.utcoffset() == timedelta(0)
    assert entry.model_dump(mode="json")["timestamp"] == "2026-10-01T01:15:30Z"


def test_dual_timestamp_header_shows_utc_and_pacific_local(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FORGE_DISPLAY_TZ", raising=False)
    get_settings.cache_clear()
    header = dual_timestamp_header(datetime(2026, 10, 1, 1, 15, 30, tzinfo=timezone.utc))
    assert header == "[TIMESTAMP] UTC: 2026-10-01T01:15:30Z | Local (PST): 2026-09-30 18:15:30 PDT"


@pytest.mark.asyncio
async def test_api_timestamps_are_iso_utc_z() -> None:
    async with _client() as client:
        audit = (await client.get("/api/v1/audit/logs")).json()["logs"]
        bundles = (await client.get("/api/v1/diagnostics/bundles")).json()
        fleet = (await client.get("/api/v1/fleet/status")).json()["sites"]

    assert audit and all(ISO_Z.match(log["timestamp"]) for log in audit)
    assert all(ISO_Z.match(b["captured_at"]) for b in bundles["bundles"])
    assert all(ISO_Z.match(site["last_seen"]) and ISO_Z.match(site["timestamp"]) for site in fleet)


@pytest.mark.asyncio
async def test_pipeline_run_emits_dual_timestamp_headers_and_utc_log_timestamps(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FORGE_MOCK_MODE", "true")
    get_settings.cache_clear()
    run = await app.state.process_runner.start_run(command="forge", args=["provision", "vms"])

    events = [e async for e in app.state.log_publisher.subscribe(run.run_id)]
    logs = [e["data"] for e in events if e["event"] == "log"]

    assert logs[0]["line"].startswith("[TIMESTAMP] UTC: ") and "| Local (PST):" in logs[0]["line"]
    assert logs[-1]["line"].startswith("[TIMESTAMP] UTC: ")
    assert all(ISO_Z.match(log["timestamp"]) for log in logs)
    assert events[-1]["event"] == "end"
