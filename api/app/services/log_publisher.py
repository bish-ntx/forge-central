from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any
from uuid import UUID

from ..schemas.pipeline import PipelineEndEventData, PipelineLogEventData


class LogPublisher:
    """In-memory pub/sub broker for per-run SSE log events."""

    def __init__(self) -> None:
        self._subscribers: dict[UUID, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)
        self._history: dict[UUID, list[dict[str, Any]]] = defaultdict(list)
        self._closed_runs: set[UUID] = set()
        self._lock = asyncio.Lock()

    async def _broadcast(self, run_id: UUID, message: dict[str, Any]) -> None:
        async with self._lock:
            self._history[run_id].append(message)
            subscribers = list(self._subscribers[run_id])
        for queue in subscribers:
            await queue.put(message)

    async def publish_log(self, run_id: UUID, payload: PipelineLogEventData) -> None:
        await self._broadcast(
            run_id,
            {
                "event": "log",
                "data": payload.model_dump(mode="json"),
            },
        )

    async def publish_end(self, run_id: UUID, payload: PipelineEndEventData) -> None:
        await self._broadcast(
            run_id,
            {
                "event": "end",
                "data": payload.model_dump(mode="json"),
            },
        )
        async with self._lock:
            self._closed_runs.add(run_id)

    async def subscribe(self, run_id: UUID):
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        async with self._lock:
            backlog = list(self._history.get(run_id, []))
            self._subscribers[run_id].add(queue)
            is_closed = run_id in self._closed_runs

        try:
            for item in backlog:
                yield item

            if is_closed:
                return

            while True:
                message = await queue.get()
                yield message
                if message.get("event") == "end":
                    return
        finally:
            async with self._lock:
                subscribers = self._subscribers.get(run_id)
                if subscribers is not None:
                    subscribers.discard(queue)
