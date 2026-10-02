from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from ..timeutil import UtcDatetime


class TelemetryStatusResponse(BaseModel):
    enabled: bool = Field(..., description="Whether the OTel exporter is enabled (FORGE_OTEL_ENABLED)")
    collector_url: str = Field(..., description="OTLP/HTTP collector endpoint (FORGE_OTEL_COLLECTOR_URL)")
    buffered_count: int = Field(0, description="Test-run records held in the local telemetry buffer")
    last_export_at: Optional[UtcDatetime] = Field(None, description="Last export time, ISO-8601 UTC")
    status: str = Field(..., description='Exporter status ("disabled", "buffering")')


class TestRunIngestRequest(BaseModel):
    __test__ = False  # not a pytest class

    cluster_name: str
    run_id: str
    suite_name: str
    passed: int = Field(..., ge=0)
    failed: int = Field(..., ge=0)
    skipped: int = Field(0, ge=0)
    duration_seconds: float = Field(..., ge=0)
    executed_at: Optional[UtcDatetime] = None
    tags: dict[str, str] = Field(default_factory=dict)
    status: str = Field(..., description='Run outcome, e.g. "passed", "failed", "error"')


class TestRunIngestResponse(BaseModel):
    __test__ = False

    ingestion_id: str
    cluster_name: str
    received_at: UtcDatetime
    status: str


class TestRunRecord(TestRunIngestRequest):
    __test__ = False

    ingestion_id: str
    received_at: UtcDatetime


class TestRunListResponse(BaseModel):
    __test__ = False

    runs: list[TestRunRecord] = Field(default_factory=list)
    total_count: int = 0


class ClusterCorrelationRecord(BaseModel):
    cluster_name: str
    cluster_status: str
    nkp_version: str
    k8s_version: str
    latest_suite: Optional[str] = None
    passed: Optional[int] = None
    failed: Optional[int] = None
    qualification_status: Literal["qualified", "failing", "untested"]
    last_tested_at: Optional[UtcDatetime] = None


class CorrelationMatrixResponse(BaseModel):
    clusters: list[ClusterCorrelationRecord] = Field(default_factory=list)
    total_qualified: int = 0
    total_failing: int = 0
    total_untested: int = 0
