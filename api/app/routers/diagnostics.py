from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException

from ..schemas.diagnostics import (
    DiagnosticsCaptureRequest,
    DiagnosticsCaptureResponse,
    SupportBundleInfo,
    SupportBundleListResponse,
)
from .audit import record_audit_event

router = APIRouter(prefix="/api/v1/diagnostics", tags=["diagnostics"])


def _iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _seed_support_bundles() -> list[dict[str, Any]]:
    return [
        {
            "bundle_id": "bundle-amd-nkp1-20260926",
            "cluster_name": "amd-nkp1",
            "filename": "bundle-amd-nkp1-20260926.tar.gz",
            "file_size_bytes": 152_034_918,
            "captured_at": "2026-09-26T10:45:00+00:00",
            "status": "ready",
        },
        {
            "bundle_id": "bundle-cirra-nkp1-20260925",
            "cluster_name": "cirra-nkp1",
            "filename": "bundle-cirra-nkp1-20260925.tar.gz",
            "file_size_bytes": 138_220_441,
            "captured_at": "2026-09-25T18:12:00+00:00",
            "status": "ready",
        },
    ]


SUPPORT_BUNDLE_STATE: list[dict[str, Any]] = _seed_support_bundles()


@router.post("/capture", response_model=DiagnosticsCaptureResponse)
async def capture_diagnostics(payload: DiagnosticsCaptureRequest) -> DiagnosticsCaptureResponse:
    """Capture a synthetic support bundle for Day-0 cluster diagnostics workflows."""
    timestamp = datetime.now(timezone.utc)
    stamp = timestamp.strftime("%Y%m%d%H%M%S")
    normalized_cluster = payload.cluster_name.strip().lower().replace(" ", "-")
    bundle_id = f"bundle-{normalized_cluster}-{stamp}"
    filename = f"{bundle_id}.tar.gz"

    node_count = len(payload.node_names or [])
    base_size = 90_000_000 if payload.include_logs else 35_000_000
    file_size_bytes = base_size + (node_count * 1_500_000)
    captured_at = timestamp.isoformat()
    status = "ready"

    bundle = SupportBundleInfo(
        bundle_id=bundle_id,
        cluster_name=payload.cluster_name,
        filename=filename,
        file_size_bytes=file_size_bytes,
        captured_at=captured_at,
        status=status,
    )
    SUPPORT_BUNDLE_STATE.insert(0, bundle.model_dump())
    record_audit_event(
        run_id=f"run-{bundle_id}",
        verb="diagnostics-capture",
        user="console-operator",
        status="succeeded",
        duration_sec=12.4,
        details={
            "cluster_name": payload.cluster_name,
            "include_logs": payload.include_logs,
            "node_names": payload.node_names or [],
            "bundle_id": bundle_id,
        },
    )
    return DiagnosticsCaptureResponse(
        **bundle.model_dump(),
        download_url=f"/api/v1/diagnostics/bundles/{bundle_id}",
    )


@router.get("/bundles", response_model=SupportBundleListResponse)
async def list_support_bundles() -> SupportBundleListResponse:
    """List synthetic support bundles available for download and review."""
    bundles = [SupportBundleInfo(**bundle) for bundle in SUPPORT_BUNDLE_STATE]
    return SupportBundleListResponse(bundles=bundles)


@router.get("/bundles/{bundle_id}", response_model=SupportBundleInfo)
async def get_support_bundle(bundle_id: str) -> SupportBundleInfo:
    """Return support bundle metadata for a specific bundle identifier."""
    for bundle in SUPPORT_BUNDLE_STATE:
        if bundle.get("bundle_id") == bundle_id:
            return SupportBundleInfo(**bundle)
    raise HTTPException(status_code=404, detail=f"support bundle not found: {bundle_id}")


def reset_support_bundle_state_for_tests() -> None:
    """Reset synthetic support bundle state for deterministic tests."""
    global SUPPORT_BUNDLE_STATE
    SUPPORT_BUNDLE_STATE = deepcopy(_seed_support_bundles())
