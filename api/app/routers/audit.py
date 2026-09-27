from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter

from ..schemas.audit import AuditLogEntry, AuditLogListResponse

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


def _iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _seed_audit_logs() -> list[dict[str, Any]]:
    return [
        {
            "run_id": "run-provision-amd-nkp1",
            "timestamp": "2026-09-26T08:15:00+00:00",
            "verb": "cluster-provision",
            "user": "platform-admin",
            "status": "succeeded",
            "duration_sec": 512.8,
            "details": {"cluster_name": "amd-nkp1", "hypervisor_type": "proxmox"},
        },
        {
            "run_id": "run-vm-poweron-amd-db01",
            "timestamp": "2026-09-26T10:02:41+00:00",
            "verb": "vm-power-on",
            "user": "lab-operator",
            "status": "succeeded",
            "duration_sec": 9.7,
            "details": {"vm_name": "amd-db-01"},
        },
        {
            "run_id": "run-diag-capture-cirra-nkp1",
            "timestamp": "2026-09-26T12:33:19+00:00",
            "verb": "diagnostics-capture",
            "user": "sre-oncall",
            "status": "succeeded",
            "duration_sec": 23.5,
            "details": {"cluster_name": "cirra-nkp1", "bundle_id": "bundle-cirra-nkp1-20260925"},
        },
    ]


AUDIT_LOG_STATE: list[dict[str, Any]] = _seed_audit_logs()


def record_audit_event(
    run_id: str,
    verb: str,
    user: str,
    status: str,
    duration_sec: float,
    details: Optional[Dict[str, Any]] = None,
) -> AuditLogEntry:
    """Record an operational audit event in deterministic in-memory state."""
    entry = AuditLogEntry(
        run_id=run_id,
        timestamp=_iso_utc_now(),
        verb=verb,
        user=user,
        status=status,
        duration_sec=duration_sec,
        details=details,
    )
    AUDIT_LOG_STATE.insert(0, entry.model_dump())
    return entry


@router.get("/logs", response_model=AuditLogListResponse)
async def list_audit_logs(verb: Optional[str] = None, status: Optional[str] = None) -> AuditLogListResponse:
    """List audit trail entries, optionally filtered by verb and status."""
    filtered = AUDIT_LOG_STATE
    if verb:
        filtered = [log for log in filtered if str(log.get("verb", "")).lower() == verb.lower()]
    if status:
        filtered = [log for log in filtered if str(log.get("status", "")).lower() == status.lower()]
    logs = [AuditLogEntry(**log) for log in filtered]
    return AuditLogListResponse(logs=logs, total_count=len(logs))


def reset_audit_logs_for_tests() -> None:
    """Reset in-memory audit log state to deterministic seed fixtures."""
    global AUDIT_LOG_STATE
    AUDIT_LOG_STATE = deepcopy(_seed_audit_logs())
