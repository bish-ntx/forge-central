# =============================================================================
# Forge Central — CLI Router
# Project: Forge Central Control Plane
# Version: 1.0.0
# Author:  Bishwajit Kumar <Bishwajit.Kumar@nutanix.com>
# Description: Health, version, and CLI execution HTTP routes.
# =============================================================================

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from ..config import get_settings
from ..schemas.cli import CLIExecuteRequest, CLIExecuteResponse, HealthResponse, VersionResponse
from ..services.process_runner import ProcessRunner

router = APIRouter()


def get_runner(request: Request) -> ProcessRunner:
    return request.app.state.process_runner


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    """Return API liveness and forge binary path information."""
    runner = get_runner(request)
    runner.forge_bin.exists()
    return HealthResponse(
        status="healthy",
        forge_bin=str(runner.forge_bin),
    )


@router.get("/api/v1/version", response_model=VersionResponse)
async def version_info(request: Request) -> VersionResponse:
    """Return control-plane version metadata and local forge version."""
    runner = get_runner(request)
    settings = get_settings()
    forge_version = await runner.get_forge_version()
    return VersionResponse(
        control_plane_version=settings.control_plane_version,
        forge_bin=str(runner.forge_bin),
        forge_version=forge_version,
    )


@router.post("/api/v1/cli/execute", response_model=CLIExecuteResponse, status_code=202)
async def execute_cli(request: Request, payload: CLIExecuteRequest) -> CLIExecuteResponse:
    """Launch an asynchronous ./forge command execution and return run metadata."""
    runner = get_runner(request)
    try:
        run = await runner.start_run(
            command=payload.command,
            args=payload.args,
            env_overrides=payload.env_overrides,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=f"forge executable not found: {exc}") from exc

    return CLIExecuteResponse(
        run_id=run.run_id,
        status=run.status.value,
        command=run.command,
        started_at=run.started_at,
    )


@router.get("/api/v1/test/live-terminal-stream")
async def live_terminal_stream() -> EventSourceResponse:
    """Emit deterministic mock SSE log events for UI automation tests."""

    async def event_generator():
        for index in range(1, 4):
            yield {
                "event": "log",
                "data": json.dumps(
                    {
                        "timestamp": f"2026-09-26T22:40:0{index}.100000+00:00",
                        "line": f"mock stdout line {index}",
                        "stream": "stdout",
                    }
                ),
            }
            await asyncio.sleep(0.15)

        yield {
            "event": "end",
            "data": json.dumps(
                {
                    "exit_code": 0,
                    "status": "COMPLETED",
                }
            ),
        }

    return EventSourceResponse(event_generator())
