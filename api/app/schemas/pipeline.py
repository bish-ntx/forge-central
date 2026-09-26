from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class PipelineLogEventData(BaseModel):
    timestamp: datetime
    line: str
    stream: Literal["stdout", "stderr"]


class PipelineEndEventData(BaseModel):
    exit_code: int
    status: Literal["COMPLETED", "FAILED"]
