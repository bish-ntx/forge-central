from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from ..timeutil import UtcDatetime


class AuditLogEntry(BaseModel):
    run_id: str
    timestamp: UtcDatetime
    verb: str
    user: str
    status: str
    duration_sec: float
    details: Optional[Dict[str, Any]] = None


class AuditLogListResponse(BaseModel):
    logs: List[AuditLogEntry] = Field(default_factory=list)
    total_count: int = 0
