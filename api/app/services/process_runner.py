# =============================================================================
# Forge Central — Process Runner Service
# Project: Forge Central Control Plane
# Version: 1.0.0
# Author:  Bishwajit Kumar <Bishwajit.Kumar@nutanix.com>
# Description: Async subprocess orchestration wrapper for local ./forge CLI.
# =============================================================================

from __future__ import annotations

import asyncio
import os
import random
import shlex
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Literal
from uuid import UUID, uuid4

from ..config import get_settings
from ..schemas.pipeline import PipelineEndEventData, PipelineLogEventData
from ..timeutil import dual_timestamp_header, iso_utc
from .log_publisher import LogPublisher


# Synthetic (stream, line) output mimicking a real ./forge pipeline run.
MOCK_LOG_LINES: list[tuple[Literal["stdout", "stderr"], str]] = [
    ("stdout", "[mock] FORGE_MOCK_MODE active — no hypervisor or cluster is contacted"),
    ("stdout", "==> Stage 1/5: Preflight checks"),
    ("stdout", "    OK  nfs exports reachable (~/nkp-forge, ~/forge-state, ~/cacrt)"),
    ("stdout", "==> Stage 2/5: Cloning VMs from template 9000"),
    ("stdout", "    clone cp-01 ... 50%"),
    ("stdout", "    clone cp-01 ... 100%"),
    ("stdout", "    clone wk-01 ... 100%"),
    ("stderr", "    WARN  hostpci0 passthrough skipped on wk-01 (simulated)"),
    ("stdout", "==> Stage 3/5: IP allocation"),
    ("stdout", "    allocated cp-01 -> 10.10.0.11, wk-01 -> 10.10.0.21"),
    ("stdout", "==> Stage 4/5: etcd quorum check"),
    ("stdout", "    etcd members healthy: 3/3 (quorum satisfied)"),
    ("stdout", "==> Stage 5/5: Cluster validation"),
    ("stdout", "    all nodes Ready"),
    ("stdout", "[mock] run completed successfully"),
]


class RunStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


@dataclass
class ProcessRun:
    run_id: UUID
    command: str
    argv: list[str]
    status: RunStatus
    started_at: datetime
    exit_code: int | None = None
    completed_at: datetime | None = None
    events: asyncio.Queue[dict[str, Any]] = field(default_factory=asyncio.Queue)


class ProcessRunner:
    def __init__(
        self, forge_bin: Path, log_publisher: LogPublisher | None = None, mock_mode: bool = False
    ) -> None:
        self._forge_bin = forge_bin.expanduser().resolve()
        self._mock_mode = mock_mode
        self._runs: dict[UUID, ProcessRun] = {}
        self._log_publisher = log_publisher

    @property
    def forge_bin(self) -> Path:
        return self._forge_bin

    def _validate_executable(self) -> None:
        if self._forge_bin.name != "forge":
            raise ValueError("FORGE_BIN must point to a 'forge' executable")

    def _use_mock(self, argv: list[str]) -> bool:
        """True when runs must be simulated instead of spawning ./forge."""
        return (
            self._mock_mode
            or get_settings().forge_mock_mode
            or "--mock" in argv
            or not (self._forge_bin.is_file() and os.access(self._forge_bin, os.X_OK))
        )

    def _parse_command(self, command: str | list[str], args: list[str]) -> list[str]:
        tokens = shlex.split(command) if isinstance(command, str) else [str(item) for item in command]
        cli_tokens = [*tokens, *args]
        if not cli_tokens:
            raise ValueError("CLI command cannot be empty")

        first = cli_tokens[0]
        first_path = Path(first).expanduser()
        forge_aliases = {"forge", "./forge", str(self._forge_bin), str(self._forge_bin.resolve())}

        if first in forge_aliases or first_path.name == "forge":
            cli_tokens = cli_tokens[1:]

        if not cli_tokens:
            raise ValueError("CLI command must include forge subcommands/flags")

        return cli_tokens

    async def _publish_stream_line(
        self, run: ProcessRun, channel: Literal["stdout", "stderr"], payload: str
    ) -> None:
        if self._log_publisher is None:
            return
        await self._log_publisher.publish_log(
            run.run_id,
            PipelineLogEventData(
                timestamp=datetime.now(timezone.utc),
                line=payload,
                stream=channel,
            ),
        )

    async def _emit_log(self, run: ProcessRun, channel: Literal["stdout", "stderr"], payload: str) -> None:
        await run.events.put(
            {
                "event": "log",
                "stream": channel,
                "line": payload,
                "timestamp": iso_utc(),
            }
        )
        await self._publish_stream_line(run, channel, payload)

    async def _mark_running(self, run: ProcessRun) -> None:
        run.status = RunStatus.RUNNING
        await run.events.put(
            {
                "event": "status",
                "status": RunStatus.RUNNING.value,
                "timestamp": iso_utc(),
            }
        )
        await self._emit_log(run, "stdout", dual_timestamp_header())

    async def _finish_run(self, run: ProcessRun, exit_code: int | None) -> None:
        await self._emit_log(run, "stdout", dual_timestamp_header())
        run.exit_code = exit_code
        run.completed_at = datetime.now(timezone.utc)
        run.status = RunStatus.COMPLETED if exit_code == 0 else RunStatus.FAILED
        await run.events.put(
            {
                "event": "status",
                "status": run.status.value,
                "exit_code": run.exit_code,
                "timestamp": iso_utc(run.completed_at),
            }
        )
        if self._log_publisher is not None and run.exit_code is not None:
            await self._log_publisher.publish_end(
                run.run_id,
                PipelineEndEventData(
                    exit_code=run.exit_code,
                    status="COMPLETED" if run.exit_code == 0 else "FAILED",
                ),
            )

    async def _run_mock(self, run: ProcessRun) -> None:
        """Simulate a ./forge run by streaming synthetic progressive output."""
        await self._mark_running(run)
        for channel, line in MOCK_LOG_LINES:
            await asyncio.sleep(random.uniform(0.02, 0.05))
            await self._emit_log(run, channel, line)
        await self._finish_run(run, 0)

    async def _run_subprocess(self, run: ProcessRun, env_overrides: dict[str, str]) -> None:
        await self._mark_running(run)

        env = os.environ.copy()
        env.update(env_overrides)

        process = await asyncio.create_subprocess_exec(
            str(self._forge_bin),
            *run.argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )

        async def read_and_publish(stream: asyncio.StreamReader, channel: Literal["stdout", "stderr"]) -> None:
            while True:
                line = await stream.readline()
                if not line:
                    return
                await self._emit_log(run, channel, line.decode(errors="replace").rstrip("\n"))

        stdout_task = asyncio.create_task(read_and_publish(process.stdout, "stdout"))  # type: ignore[arg-type]
        stderr_task = asyncio.create_task(read_and_publish(process.stderr, "stderr"))  # type: ignore[arg-type]

        await process.wait()
        await asyncio.gather(stdout_task, stderr_task)

        await self._finish_run(run, process.returncode)

    async def start_run(
        self,
        command: str | list[str],
        args: list[str] | None = None,
        env_overrides: dict[str, str] | None = None,
    ) -> ProcessRun:
        self._validate_executable()
        parsed_args = self._parse_command(command, args or [])
        run = ProcessRun(
            run_id=uuid4(),
            command=" ".join([str(self._forge_bin), *parsed_args]),
            argv=parsed_args,
            status=RunStatus.PENDING,
            started_at=datetime.now(timezone.utc),
        )
        self._runs[run.run_id] = run
        if self._use_mock(parsed_args):
            asyncio.create_task(self._run_mock(run))
        else:
            asyncio.create_task(self._run_subprocess(run, env_overrides or {}))
        return run

    def get_run(self, run_id: UUID) -> ProcessRun | None:
        return self._runs.get(run_id)

    async def get_forge_version(self) -> str:
        if not self._forge_bin.exists():
            return "unavailable"
        try:
            process = await asyncio.create_subprocess_exec(
                str(self._forge_bin),
                "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _stderr = await process.communicate()
            if process.returncode != 0:
                return "unavailable"
            return stdout.decode(errors="replace").strip() or "unknown"
        except FileNotFoundError:
            return "unavailable"
