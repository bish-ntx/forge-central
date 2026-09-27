from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class SiteSnapshot(BaseModel):
    site_id: str = Field(..., description="Unique site identifier")
    site_name: str = Field(..., description="Human readable site name")
    location: str = Field(..., description="Site location")
    status: str = Field(..., description='Site health status ("HEALTHY", "DEGRADED", "STALE")')
    clusters_count: int = Field(0, description="Number of clusters for this site")
    vms_count: int = Field(0, description="Number of VMs for this site")
    ipam_utilization_pct: float = Field(0.0, description="IPAM utilization percentage for this site")
    gpu_nodes_count: int = Field(0, description="Number of GPU nodes for this site")
    timestamp: Optional[str] = Field(None, description="Snapshot timestamp in ISO-8601 format")
    details: Optional[Dict[str, Any]] = Field(None, description="Optional site telemetry details")


class SiteStatus(BaseModel):
    site_id: str = Field(..., description="Unique site identifier")
    site_name: str = Field(..., description="Human readable site name")
    location: str = Field(..., description="Site location")
    status: str = Field(..., description='Site health status ("HEALTHY", "DEGRADED", "STALE")')
    clusters_count: int = Field(0, description="Number of clusters for this site")
    vms_count: int = Field(0, description="Number of VMs for this site")
    ipam_utilization_pct: float = Field(0.0, description="IPAM utilization percentage for this site")
    gpu_nodes_count: int = Field(0, description="Number of GPU nodes for this site")
    timestamp: Optional[str] = Field(None, description="Snapshot timestamp in ISO-8601 format")
    details: Optional[Dict[str, Any]] = Field(None, description="Optional site telemetry details")
    last_seen: Optional[str] = Field(None, description="Last update time in ISO-8601 format")


class FleetStatusResponse(BaseModel):
    sites: list[SiteStatus] = Field(default_factory=list, description="Fleet site status list")
    total_clusters: int = Field(0, description="Total clusters across all sites")
    total_vms: int = Field(0, description="Total VMs across all sites")
    total_gpu_nodes: int = Field(0, description="Total GPU nodes across all sites")
    hq_sync_status: str = Field(..., description="HQ sync status")
