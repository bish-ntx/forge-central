from __future__ import annotations

import hashlib
from pathlib import Path
import sys

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.main import app


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_upgrade_status():
    async with _client() as client:
        response = await client.get("/api/v1/upgrade/status")
    body = response.json()
    assert response.status_code == 200
    assert body["current_version"] == "1.0.0"
    assert body["arch"] and body["platform"]
    assert body["last_upgrade_at"] is None


@pytest.mark.asyncio
async def test_inspect_valid_bundle(tmp_path):
    bundle = tmp_path / "forge-central-v1.1.0.tar.gz"
    bundle.write_bytes(b"mock-bundle")
    (tmp_path / (bundle.name + ".sha256")).write_text(f"{hashlib.sha256(b'mock-bundle').hexdigest()}  {bundle.name}\n")
    async with _client() as client:
        response = await client.post("/api/v1/upgrade/inspect", json={"bundle_path": str(bundle)})
    body = response.json()
    assert response.status_code == 200
    assert body["valid"] is True
    assert body["bundle_version"] == "1.1.0"
    assert [check["name"] for check in body["checks"]] == [
        "Bundle format",
        "Checksum",
        "Version compatibility",
        "Disk space",
    ]
    assert all(check["passed"] for check in body["checks"])


@pytest.mark.asyncio
async def test_inspect_checksum_mismatch_and_older_version(tmp_path):
    bundle = tmp_path / "forge-central-v0.9.0.tar.gz"
    bundle.write_bytes(b"mock-bundle")
    (tmp_path / (bundle.name + ".sha256")).write_text("deadbeef  x\n")
    async with _client() as client:
        response = await client.post("/api/v1/upgrade/inspect", json={"bundle_path": str(bundle)})
    checks = {check["name"]: check["passed"] for check in response.json()["checks"]}
    assert response.json()["valid"] is False
    assert checks["Checksum"] is False
    assert checks["Version compatibility"] is False


@pytest.mark.asyncio
async def test_inspect_invalid_bundle_path(tmp_path):
    async with _client() as client:
        response = await client.post("/api/v1/upgrade/inspect", json={"bundle_path": str(tmp_path / "missing.zip")})
    body = response.json()
    assert response.status_code == 200
    assert body["valid"] is False
    assert body["bundle_version"] == "unknown"
    assert body["checks"][0]["passed"] is False
