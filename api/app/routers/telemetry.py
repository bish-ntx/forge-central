from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Request

from ..schemas.telemetry import (
    CorrelationMatrixResponse,
    TelemetryStatusResponse,
    TestRunIngestRequest,
    TestRunIngestResponse,
    TestRunListResponse,
)
from ..services import telemetry as telemetry_service
from .clusters import list_clusters

router = APIRouter(prefix="/api/v1/telemetry", tags=["telemetry"])


@router.get("/status", response_model=TelemetryStatusResponse)
async def get_telemetry_status() -> TelemetryStatusResponse:
    """Return OTel exporter status (enabled flag, collector URL) and local buffer depth."""
    return telemetry_service.get_exporter_status()


@router.post("/ingest/test-run", response_model=TestRunIngestResponse)
async def ingest_test_run(payload: TestRunIngestRequest) -> TestRunIngestResponse:
    """Ingest a Day-2 qualification test run (nkpday2 GPU/CSI) and record a `telemetry-ingested` audit event."""
    return telemetry_service.ingest_test_run(payload)


@router.get("/runs", response_model=TestRunListResponse)
async def list_test_runs(cluster_name: Optional[str] = None) -> TestRunListResponse:
    """List ingested test runs (newest first), optionally filtered by `cluster_name`."""
    runs = telemetry_service.list_test_runs(cluster_name)
    return TestRunListResponse(runs=runs, total_count=len(runs))


@router.get("/correlation", response_model=CorrelationMatrixResponse)
async def get_correlation_matrix(request: Request) -> CorrelationMatrixResponse:
    """Correlate known clusters with their latest ingested test run (qualified / failing / untested)."""
    clusters = (await list_clusters(request)).clusters
    return telemetry_service.build_correlation([cluster.model_dump() for cluster in clusters])
