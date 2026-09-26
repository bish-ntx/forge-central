from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from ..services.log_publisher import LogPublisher
from ..services.process_runner import ProcessRunner

router = APIRouter(prefix="/api/v1/pipeline", tags=["pipeline"])


def get_runner(request: Request) -> ProcessRunner:
    return request.app.state.process_runner


def get_log_publisher(request: Request) -> LogPublisher:
    return request.app.state.log_publisher


@router.get("/{run_id}/stream")
async def stream_pipeline_logs(request: Request, run_id: UUID) -> EventSourceResponse:
    """Stream real-time pipeline stdout/stderr logs over Server-Sent Events."""
    runner = get_runner(request)
    log_publisher = get_log_publisher(request)
    run = runner.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"pipeline run not found: {run_id}")

    async def event_generator():
        async for item in log_publisher.subscribe(run_id):
            yield {
                "event": item["event"],
                "data": json.dumps(item["data"]),
            }

    return EventSourceResponse(event_generator())
