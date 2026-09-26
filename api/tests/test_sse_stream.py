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
async def test_pipeline_stream_endpoint_emits_log_and_end_events(monkeypatch: pytest.MonkeyPatch) -> None:
    run_id = uuid4()

    async def fake_subscribe(_run_id):
        _ = _run_id
        yield {
            "event": "log",
            "data": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "line": "step 01: starting",
                "stream": "stdout",
            },
        }
        yield {
            "event": "end",
            "data": {"exit_code": 0, "status": "COMPLETED"},
        }

    def fake_get_run(_run_id):
        _ = _run_id
        return ProcessRun(
            run_id=run_id,
            command="./forge create cluster --dry-run",
            argv=["create", "cluster", "--dry-run"],
            status=RunStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
        )

    monkeypatch.setattr(app.state.log_publisher, "subscribe", fake_subscribe)
    monkeypatch.setattr(app.state.process_runner, "get_run", fake_get_run)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        async with client.stream("GET", f"/api/v1/pipeline/{run_id}/stream") as response:
            assert response.status_code == 200
            body_lines = [line async for line in response.aiter_lines() if line]

    assert "event: log" in body_lines
    assert "event: end" in body_lines
    assert any('"stream": "stdout"' in line for line in body_lines)
    assert any('"status": "COMPLETED"' in line for line in body_lines)


@pytest.mark.asyncio
async def test_pipeline_stream_endpoint_returns_404_for_missing_run(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(app.state.process_runner, "get_run", lambda _run_id: None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/pipeline/{uuid4()}/stream")

    assert response.status_code == 404
