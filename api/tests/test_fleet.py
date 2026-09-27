from __future__ import annotations

from pathlib import Path
import sys

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.main import app
from api.app.routers import fleet as fleet_router


@pytest.fixture(autouse=True)
def reset_fleet_state() -> None:
    fleet_router.reset_site_state_for_tests()


@pytest.mark.asyncio
async def test_get_fleet_status_returns_seeded_sites_and_totals() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/fleet/status")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["sites"]) == 3
    assert payload["total_clusters"] == 6
    assert payload["total_vms"] == 36
    assert payload["total_gpu_nodes"] == 14
    assert payload["hq_sync_status"] == "ONLINE"


@pytest.mark.asyncio
async def test_snapshot_updates_site_telemetry() -> None:
    snapshot = {
        "site_id": "amd-lab",
        "site_name": "AMD Lab",
        "location": "Santa Clara, CA",
        "status": "DEGRADED",
        "clusters_count": 5,
        "vms_count": 22,
        "ipam_utilization_pct": 71.5,
        "gpu_nodes_count": 6,
        "timestamp": "2026-09-26T23:00:00+00:00",
        "details": {"note": "maintenance window"},
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        post_response = await client.post("/api/v1/fleet/snapshot", json=snapshot)
        get_response = await client.get("/api/v1/fleet/sites/amd-lab")

    assert post_response.status_code == 200
    post_payload = post_response.json()
    assert post_payload["status"] == "recorded"
    assert post_payload["site_id"] == "amd-lab"
    assert "recorded_at" in post_payload

    assert get_response.status_code == 200
    payload = get_response.json()
    assert payload["status"] == "DEGRADED"
    assert payload["clusters_count"] == 5
    assert payload["vms_count"] == 22
    assert payload["gpu_nodes_count"] == 6
    assert payload["ipam_utilization_pct"] == 71.5


@pytest.mark.asyncio
async def test_get_specific_site_returns_site_status() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/fleet/sites/cirra-lab")

    assert response.status_code == 200
    payload = response.json()
    assert payload["site_id"] == "cirra-lab"
    assert payload["site_name"] == "Cirrascale Lab"
    assert payload["location"] == "San Jose, CA"


@pytest.mark.asyncio
async def test_get_unknown_site_returns_404() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/fleet/sites/unknown")

    assert response.status_code == 404
