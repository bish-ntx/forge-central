# =============================================================================
# Forge Central — Inventory Router Tests
# Project: Forge Central Control Plane
# Version: 1.0.0
# Author:  Bishwajit Kumar <Bishwajit.Kumar@nutanix.com>
# Description: Unit tests for PreprovisionedInventory REST endpoints.
# =============================================================================

from __future__ import annotations

from pathlib import Path
import sys

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.config import get_settings
from api.app.main import app

SAMPLE_INVENTORY_YAML = """apiVersion: infrastructure.cluster.x-k8s.io/v1alpha1
kind: PreprovisionedInventory
metadata:
  name: inventory-lab-01
spec:
  hosts:
    - address: 10.10.40.11
      labels:
        cluster.x-k8s.io/role: control-plane
    - address: 10.10.40.12
      labels:
        cluster.x-k8s.io/role: control-plane
    - address: 10.10.40.13
      labels:
        cluster.x-k8s.io/role: control-plane
    - address: 10.10.40.21
      labels:
        cluster.x-k8s.io/role: worker
    - address: 10.10.40.22
      labels:
        cluster.x-k8s.io/role: worker
"""


@pytest.fixture
def mock_forge_data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    data_dir = tmp_path / "forge-data"
    data_dir.mkdir(parents=True, exist_ok=True)
    inv_file = data_dir / "inventory-lab-01.yaml"
    inv_file.write_text(SAMPLE_INVENTORY_YAML, encoding="utf-8")

    def fake_get_settings():
        settings = get_settings()
        settings.forge_data_dir = data_dir
        return settings

    monkeypatch.setattr("api.app.routers.inventory.get_settings", fake_get_settings)
    return data_dir


@pytest.mark.asyncio
async def test_list_inventories_returns_files(mock_forge_data_dir: Path) -> None:
    _ = mock_forge_data_dir
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/inventory/list")

    assert response.status_code == 200
    payload = response.json()
    assert "files" in payload
    assert len(payload["files"]) >= 1
    file_item = next(f for f in payload["files"] if f["filename"] == "inventory-lab-01.yaml")
    assert file_item["node_count"] == 5
    assert file_item["control_plane_count"] == 3
    assert file_item["worker_count"] == 2


@pytest.mark.asyncio
async def test_get_inventory_detail_returns_content(mock_forge_data_dir: Path) -> None:
    _ = mock_forge_data_dir
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/inventory/inventory-lab-01.yaml")

    assert response.status_code == 200
    payload = response.json()
    assert payload["filename"] == "inventory-lab-01.yaml"
    assert "PreprovisionedInventory" in payload["raw_yaml"]
    assert payload["node_count"] == 5
    assert len(payload["control_plane_nodes"]) == 3
    assert len(payload["worker_nodes"]) == 2
    assert "10.10.40.11" in payload["control_plane_nodes"]
    assert "10.10.40.21" in payload["worker_nodes"]


@pytest.mark.asyncio
async def test_get_inventory_not_found(mock_forge_data_dir: Path) -> None:
    _ = mock_forge_data_dir
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/inventory/nonexistent.yaml")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_validate_inventory_returns_diagnostics(mock_forge_data_dir: Path) -> None:
    _ = mock_forge_data_dir
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/inventory/validate",
            json={"filename": "inventory-lab-01.yaml"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert "valid" in payload
    assert payload["valid"] is True
    assert "check_results" in payload
    assert len(payload["check_results"]) >= 3
    check_names = [chk["name"] for chk in payload["check_results"]]
    assert any("YAML Syntax" in name for name in check_names)
    assert any("Control Plane Quorum" in name for name in check_names)
