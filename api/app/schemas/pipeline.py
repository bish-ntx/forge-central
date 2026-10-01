from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from ..timeutil import UtcDatetime


class PipelineLogEventData(BaseModel):
    timestamp: UtcDatetime
    line: str
    stream: Literal["stdout", "stderr"]


class PipelineEndEventData(BaseModel):
    exit_code: int
    status: Literal["COMPLETED", "FAILED"]
