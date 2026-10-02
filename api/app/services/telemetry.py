"""Telemetry ingestion + cross-repo correlation (Forge Central clusters x Day-2 test runs).

Test runs persist as a JSON list in ``<FORGE_DATA_DIR>/telemetry/test-runs.json``. The OTel exporter
is a lightweight local buffer (no opentelemetry SDK dependency): every stored run counts as buffered.
"""

from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Optional
from uuid import uuid4

from ..config import get_settings
from ..routers.audit import record_audit_event
from ..schemas.telemetry import (
    ClusterCorrelationRecord,
    CorrelationMatrixResponse,
    TelemetryStatusResponse,
    TestRunIngestRequest,
    TestRunIngestResponse,
    TestRunRecord,
)
from ..timeutil import iso_utc, to_utc

PASS_STATUSES = {"passed", "pass", "success", "succeeded", "ok"}


def _runs_file() -> Path:
    return get_settings().forge_data_dir.expanduser() / "telemetry" / "test-runs.json"


def _load() -> list[dict[str, Any]]:
    path = _runs_file()
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


def _save(runs: list[dict[str, Any]]) -> None:
    path = _runs_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(runs, indent=2))
    tmp.replace(path)


def ingest_test_run(payload: TestRunIngestRequest) -> TestRunIngestResponse:
    """Persist a Day-2 test run and record a ``telemetry-ingested`` audit event."""
    started = time.monotonic()
    ingestion_id = f"ing-{uuid4().hex[:12]}"
    received_at = iso_utc()
    record = TestRunRecord(**payload.model_dump(), ingestion_id=ingestion_id, received_at=received_at)
    _save([*_load(), record.model_dump(mode="json")])
    record_audit_event(
        run_id=ingestion_id,
        verb="telemetry-ingested",
        user="telemetry-ingest",
        status="succeeded",
        duration_sec=round(time.monotonic() - started, 3),
        details={
            "cluster_name": payload.cluster_name,
            "suite_name": payload.suite_name,
            "test_run_id": payload.run_id,
            "passed": payload.passed,
            "failed": payload.failed,
            "status": payload.status,
        },
    )
    return TestRunIngestResponse(
        ingestion_id=ingestion_id, cluster_name=payload.cluster_name, received_at=received_at, status="accepted"
    )


def _tested_at(run: TestRunRecord) -> datetime:
    return to_utc(run.executed_at or run.received_at)


def list_test_runs(cluster_name: Optional[str] = None) -> list[TestRunRecord]:
    """Return stored runs, newest first, optionally filtered by cluster."""
    runs = [TestRunRecord(**raw) for raw in _load()]
    if cluster_name:
        runs = [run for run in runs if run.cluster_name == cluster_name]
    return sorted(runs, key=_tested_at, reverse=True)


def get_exporter_status() -> TelemetryStatusResponse:
    """Report OTel exporter flags and local buffer depth."""
    settings = get_settings()
    return TelemetryStatusResponse(
        enabled=settings.forge_otel_enabled,
        collector_url=settings.forge_otel_collector_url,
        buffered_count=len(_load()),
        last_export_at=None,
        status="buffering" if settings.forge_otel_enabled else "disabled",
    )


def qualification_status(run: Optional[TestRunRecord]) -> str:
    if run is None:
        return "untested"
    if run.failed == 0 and run.status.strip().lower() in PASS_STATUSES:
        return "qualified"
    return "failing"


def build_correlation(clusters: Iterable[dict[str, Any]]) -> CorrelationMatrixResponse:
    """Join known clusters with their latest ingested test run."""
    latest: dict[str, TestRunRecord] = {}
    for run in list_test_runs():  # newest first -> first seen wins
        latest.setdefault(run.cluster_name, run)
    records = []
    for cluster in clusters:
        name = str(cluster.get("name", ""))
        run = latest.get(name)
        records.append(
            ClusterCorrelationRecord(
                cluster_name=name,
                cluster_status=str(cluster.get("status", "unknown")),
                nkp_version=str(cluster.get("nkp_version") or "unknown"),
                k8s_version=str(cluster.get("kubernetes_version", "")),
                latest_suite=run.suite_name if run else None,
                passed=run.passed if run else None,
                failed=run.failed if run else None,
                qualification_status=qualification_status(run),  # type: ignore[arg-type]
                last_tested_at=_tested_at(run) if run else None,
            )
        )
    counts = {s: sum(r.qualification_status == s for r in records) for s in ("qualified", "failing", "untested")}
    return CorrelationMatrixResponse(
        clusters=records,
        total_qualified=counts["qualified"],
        total_failing=counts["failing"],
        total_untested=counts["untested"],
    )
