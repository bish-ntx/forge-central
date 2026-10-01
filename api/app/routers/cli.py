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
import shlex

from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from ..config import get_settings
from ..schemas.cli import (
    CLIExecuteRequest,
    CLIExecuteResponse,
    CliOptionSchema,
    CliSnippetRequest,
    CliSnippetResponse,
    CliVerbSchemaResponse,
    HealthResponse,
    VersionResponse,
)
from ..services.process_runner import ProcessRunner

router = APIRouter()


def _opt(name: str, type_: str, description: str, default=None, required: bool = False) -> CliOptionSchema:
    return CliOptionSchema(name=name, type=type_, default=default, description=description, required=required)


# Core ./forge verbs: (CLI words, description, options, example)
CLI_VERBS: dict[str, tuple[str, str, list[CliOptionSchema], str]] = {
    "provision-vms": (
        "provision vms",
        "Provision one or more virtual machines from a template.",
        [
            _opt("--template-id", "int", "Source template VMID.", required=True),
            _opt("--count", "int", "Number of VMs to create.", 1),
            _opt("--node", "string", "Target hypervisor node."),
            _opt("--base-name", "string", "Base name prefix for new VMs.", "forge-vm"),
        ],
        "./forge provision vms --template-id 9000 --count 3 --node pve1 --base-name nkp-worker",
    ),
    "create-cluster": (
        "create cluster",
        "Create a preprovisioned NKP cluster.",
        [
            _opt("--cluster-name", "string", "Cluster name.", required=True),
            _opt("--control-plane-nodes", "int", "Number of control plane nodes.", 3),
            _opt("--worker-nodes", "int", "Number of worker nodes.", 3),
            _opt("--kubernetes-version", "string", "Kubernetes version.", "v1.31.1"),
            _opt("--hypervisor-type", "string", "Hypervisor: proxmox or ahv.", "proxmox"),
        ],
        "./forge create cluster --cluster-name demo --control-plane-nodes 3 --worker-nodes 3 "
        "--kubernetes-version v1.31.1 --hypervisor-type proxmox",
    ),
    "reset-nodes": (
        "reset nodes",
        "Reset nodes of a cluster back to a clean state.",
        [
            _opt("--cluster-name", "string", "Cluster name.", required=True),
            _opt("--node-names", "string", "Comma-separated node names."),
        ],
        "./forge reset nodes --cluster-name demo --node-names node1,node2",
    ),
    "diagnose": (
        "diagnose",
        "Collect a diagnostics bundle for a cluster.",
        [
            _opt("--cluster-name", "string", "Cluster name.", required=True),
            _opt("--include-logs", "boolean", "Include node logs in the bundle.", False),
        ],
        "./forge diagnose --cluster-name demo --include-logs",
    ),
    "share": (
        "share",
        "Share a directory with cluster nodes.",
        [
            _opt("--share-name", "string", "Share name.", required=True),
            _opt("--mount-path", "string", "Mount path on nodes."),
        ],
        "./forge share --share-name data --mount-path /mnt/data",
    ),
    "secret": (
        "secret",
        "Manage stored secrets.",
        [
            _opt("--action", "string", "Action: set, get, delete or list.", required=True),
            _opt("--secret-name", "string", "Secret name."),
        ],
        "./forge secret --action set --secret-name api-token",
    ),
}


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
        mock_mode=get_settings().forge_mock_mode,
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
                        "timestamp": f"2026-09-26T22:40:0{index}Z",
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


@router.get("/api/v1/cli/schema/{verb}", response_model=CliVerbSchemaResponse)
async def get_cli_verb_schema(verb: str) -> CliVerbSchemaResponse:
    """Return the option schema for a recognized ./forge CLI verb (404 if unknown)."""
    entry = CLI_VERBS.get(verb)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Unknown CLI verb: {verb}")
    _, description, options, example = entry
    return CliVerbSchemaResponse(verb=verb, description=description, options=options, example=example)


@router.post("/api/v1/cli/generate-snippet", response_model=CliSnippetResponse)
async def generate_cli_snippet(payload: CliSnippetRequest) -> CliSnippetResponse:
    """Build a deterministic bash `./forge` command from a verb and parameters."""
    entry = CLI_VERBS.get(payload.verb)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Unknown CLI verb: {payload.verb}")
    parts = ["./forge", entry[0]]
    for key, value in payload.params.items():
        flag = "--" + str(key).lstrip("-").replace("_", "-")
        if isinstance(value, bool):
            if value:
                parts.append(flag)
        elif value is not None:
            parts.extend([flag, shlex.quote(str(value))])
    return CliSnippetResponse(verb=payload.verb, command=" ".join(parts))
