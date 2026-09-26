# =============================================================================
# Forge Central — Inventory Schemas
# Project: Forge Central Control Plane
# Version: 1.0.0
# Author:  Bishwajit Kumar <Bishwajit.Kumar@nutanix.com>
# Description: Pydantic v2 schemas for PreprovisionedInventory REST routes.
# =============================================================================

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class InventoryItem(BaseModel):
    filename: str = Field(..., description="Inventory filename (e.g. inventory-lab-01.yaml)")
    node_count: int = Field(0, description="Total node count parsed from file")
    control_plane_count: int = Field(0, description="Control plane node count")
    worker_count: int = Field(0, description="Worker node count")


class InventoryListResponse(BaseModel):
    files: list[InventoryItem] = Field(default_factory=list, description="List of available inventory files")


class InventoryDetailResponse(BaseModel):
    filename: str = Field(..., description="Inventory filename")
    raw_yaml: str = Field(..., description="Raw YAML or INI content")
    node_count: int = Field(..., description="Total node count")
    control_plane_nodes: list[str] = Field(default_factory=list, description="List of control plane hostnames or IPs")
    worker_nodes: list[str] = Field(default_factory=list, description="List of worker hostnames or IPs")


class InventoryValidationRequest(BaseModel):
    filename: str = Field(..., description="Target inventory filename in FORGE_DATA_DIR")


class ValidationCheck(BaseModel):
    name: str = Field(..., description="Diagnostic check name")
    status: Literal["pass", "warn", "fail"] = Field(..., description="Check status result")
    message: str = Field(..., description="Detailed diagnostic check status message")


class InventoryValidationResponse(BaseModel):
    valid: bool = Field(..., description="True if all critical checks pass")
    check_results: list[ValidationCheck] = Field(default_factory=list, description="Individual check results")
