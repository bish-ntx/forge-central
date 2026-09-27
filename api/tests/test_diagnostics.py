from __future__ import annotations

from pathlib import Path
import sys

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.main import app
from api.app.routers.audit import reset_audit_logs_for_tests
from api.app.routers.diagnostics import reset_support_bundle_state_for_tests


@pytest.mark.asyncio
async def test_capture_diagnostics_returns_bundle_response() -> None:
    reset_support_bundle_state_for_tests()
    reset_audit_logs_for_tests()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/diagnostics/capture",
            json={
                "cluster_name": "amd-nkp1",
                "include_logs": True,
                "node_names": ["amd-nkp1-cp-1", "amd-nkp1-md-1"],
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["cluster_name"] == "amd-nkp1"
    assert payload["filename"].endswith(".tar.gz")
    assert payload["status"] == "ready"
    assert payload["file_size_bytes"] > 90_000_000
    assert payload["download_url"].endswith(payload["bundle_id"])


@pytest.mark.asyncio
async def test_list_support_bundles_includes_seeded_entries() -> None:
    reset_support_bundle_state_for_tests()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/diagnostics/bundles")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["bundles"]) >= 2
    assert payload["bundles"][0]["filename"].endswith(".tar.gz")


@pytest.mark.asyncio
async def test_get_bundle_by_id_returns_expected_bundle() -> None:
    reset_support_bundle_state_for_tests()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/diagnostics/bundles/bundle-amd-nkp1-20260926")

    assert response.status_code == 200
    payload = response.json()
    assert payload["cluster_name"] == "amd-nkp1"
    assert payload["status"] == "ready"


@pytest.mark.asyncio
async def test_get_bundle_by_id_returns_404_for_unknown_bundle() -> None:
    reset_support_bundle_state_for_tests()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/diagnostics/bundles/bundle-does-not-exist")

    assert response.status_code == 404
