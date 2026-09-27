from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from ..schemas.fleet import FleetStatusResponse, SiteSnapshot, SiteStatus

router = APIRouter(prefix="/api/v1/fleet", tags=["fleet"])


def _iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _seed_sites() -> dict[str, dict[str, object]]:
    now = _iso_utc_now()
    return {
        "amd-lab": {
            "site_id": "amd-lab",
            "site_name": "AMD Lab",
            "location": "Santa Clara, CA",
            "status": "HEALTHY",
            "clusters_count": 2,
            "vms_count": 12,
            "ipam_utilization_pct": 45.0,
            "gpu_nodes_count": 4,
            "timestamp": now,
            "details": None,
            "last_seen": now,
        },
        "cirra-lab": {
            "site_id": "cirra-lab",
            "site_name": "Cirrascale Lab",
            "location": "San Jose, CA",
            "status": "HEALTHY",
            "clusters_count": 1,
            "vms_count": 8,
            "ipam_utilization_pct": 30.0,
            "gpu_nodes_count": 8,
            "timestamp": now,
            "details": None,
            "last_seen": now,
        },
        "ntx-lab": {
            "site_id": "ntx-lab",
            "site_name": "Nutanix Durham Lab",
            "location": "Durham, NC",
            "status": "HEALTHY",
            "clusters_count": 3,
            "vms_count": 16,
            "ipam_utilization_pct": 62.5,
            "gpu_nodes_count": 2,
            "timestamp": now,
            "details": None,
            "last_seen": now,
        },
    }


SITE_STATE: dict[str, dict[str, object]] = _seed_sites()


@router.post("/snapshot")
async def record_site_snapshot(snapshot: SiteSnapshot) -> dict[str, str]:
    """Record or update a site telemetry snapshot from a remote lab."""
    recorded_at = _iso_utc_now()
    SITE_STATE[snapshot.site_id] = {
        **snapshot.model_dump(),
        "site_id": snapshot.site_id,
        "last_seen": recorded_at,
        "timestamp": snapshot.timestamp or recorded_at,
    }
    return {"status": "recorded", "site_id": snapshot.site_id, "recorded_at": recorded_at}


@router.get("/status", response_model=FleetStatusResponse)
async def get_fleet_status() -> FleetStatusResponse:
    """Return fleet-wide read-only status and aggregate totals."""
    sites = [SiteStatus(**site) for site in SITE_STATE.values()]
    return FleetStatusResponse(
        sites=sites,
        total_clusters=sum(site.clusters_count for site in sites),
        total_vms=sum(site.vms_count for site in sites),
        total_gpu_nodes=sum(site.gpu_nodes_count for site in sites),
        hq_sync_status="ONLINE",
    )


@router.get("/sites/{site_id}", response_model=SiteStatus)
async def get_site_status(site_id: str) -> SiteStatus:
    """Return a specific site status snapshot."""
    site = SITE_STATE.get(site_id)
    if not site:
        raise HTTPException(status_code=404, detail=f"site not found: {site_id}")
    return SiteStatus(**site)


def reset_site_state_for_tests() -> None:
    """Reset in-memory fleet site state to seed data (test helper)."""
    global SITE_STATE
    SITE_STATE = deepcopy(_seed_sites())
