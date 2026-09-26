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
import shlex
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4


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
    def __init__(self, forge_bin: Path) -> None:
        self._forge_bin = forge_bin.expanduser().resolve()
        self._runs: dict[UUID, ProcessRun] = {}

    @property
    def forge_bin(self) -> Path:
        return self._forge_bin

    def _validate_executable(self) -> None:
        if self._forge_bin.name != "forge":
            raise ValueError("FORGE_BIN must point to a 'forge' executable")

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

    @staticmethod
    async def _read_stream(stream: asyncio.StreamReader, run: ProcessRun, channel: str) -> None:
        while True:
            line = await stream.readline()
            if not line:
                return
            payload = line.decode(errors="replace").rstrip("\n")
            await run.events.put(
                {
                    "event": "log",
                    "stream": channel,
                    "line": payload,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )

    async def _run_subprocess(self, run: ProcessRun, env_overrides: dict[str, str]) -> None:
        run.status = RunStatus.RUNNING
        await run.events.put(
            {
                "event": "status",
                "status": RunStatus.RUNNING.value,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

        env = os.environ.copy()
        env.update(env_overrides)

        process = await asyncio.create_subprocess_exec(
            str(self._forge_bin),
            *run.argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )

        stdout_task = asyncio.create_task(self._read_stream(process.stdout, run, "stdout"))  # type: ignore[arg-type]
        stderr_task = asyncio.create_task(self._read_stream(process.stderr, run, "stderr"))  # type: ignore[arg-type]

        await process.wait()
        await asyncio.gather(stdout_task, stderr_task)

        run.exit_code = process.returncode
        run.completed_at = datetime.now(timezone.utc)
        run.status = RunStatus.COMPLETED if process.returncode == 0 else RunStatus.FAILED
        await run.events.put(
            {
                "event": "status",
                "status": run.status.value,
                "exit_code": run.exit_code,
                "timestamp": run.completed_at.isoformat(),
            }
        )

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
