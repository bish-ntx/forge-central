from __future__ import annotations

from pathlib import Path
import sys

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.config import get_settings
from api.app.main import app
from api.app.routers import audit
from api.app.routers.audit import reset_audit_logs_for_tests


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
def path_env(tmp_path, monkeypatch):
    (tmp_path / "home").mkdir()
    monkeypatch.setenv("FORGE_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("FORGE_DATA_DIR", str(tmp_path / "missing"))
    monkeypatch.setenv("FORGE_CENTRAL_DATA_DIR", str(tmp_path / "home"))
    monkeypatch.setenv("FORGE_BACKUP_DIR", str(tmp_path / "home"))
    monkeypatch.setenv("FORGE_LOG_DIR", str(tmp_path / "home"))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def source_tree(tmp_path):
    src = tmp_path / "src"
    (src / "sub").mkdir(parents=True)
    (src / "forge.ini").write_text("[a]\nb=1\n")
    (src / "sub" / "inv.yaml").write_text("k: v\n")
    (src / "run.log").write_text("line\n")
    (src / "ignore.txt").write_text("skip\n")
    return src


@pytest.mark.asyncio
async def test_get_paths_returns_status_and_disk_info(path_env) -> None:
    async with _client() as client:
        response = await client.get("/api/v1/settings/paths")

    assert response.status_code == 200
    items = {item["name"]: item for item in response.json()["paths"]}
    assert set(items) == {
        "FORGE_HOME",
        "FORGE_DATA_DIR",
        "FORGE_CENTRAL_DATA_DIR",
        "FORGE_BACKUP_DIR",
        "FORGE_LOG_DIR",
    }
    assert items["FORGE_HOME"]["status"] == "accessible"
    assert items["FORGE_HOME"]["total_bytes"] > 0
    assert items["FORGE_DATA_DIR"]["status"] == "missing"
    assert items["FORGE_DATA_DIR"]["exists"] is False
    central = items["FORGE_CENTRAL_DATA_DIR"]
    assert central["path"] == str(get_settings().forge_central_data_dir.expanduser())
    assert central["status"] == "accessible" and central["accessible"] and central["writable"]
    assert get_settings().forge_central_data_dir_resolved == get_settings().forge_central_data_dir.expanduser().resolve()


def test_forge_central_data_dir_default_is_dedicated(monkeypatch) -> None:
    monkeypatch.delenv("FORGE_CENTRAL_DATA_DIR", raising=False)
    get_settings.cache_clear()
    try:
        assert str(get_settings().forge_central_data_dir) == "~/forge-central-data"
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_migrate_dry_run_does_not_modify_disk(tmp_path, source_tree) -> None:
    target = tmp_path / "dst"
    reset_audit_logs_for_tests()
    async with _client() as client:
        response = await client.post(
            "/api/v1/settings/paths/migrate",
            json={"source_dir": str(source_tree), "target_dir": str(target), "dry_run": True},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True and body["dry_run"] is True
    assert body["files_scanned"] == 3
    assert body["files_migrated"] == 0
    assert not target.exists()
    assert audit.AUDIT_LOG_STATE[0]["verb"] == "paths-migrated"


@pytest.mark.asyncio
async def test_migrate_copies_files(tmp_path, source_tree) -> None:
    target = tmp_path / "dst"
    async with _client() as client:
        response = await client.post(
            "/api/v1/settings/paths/migrate",
            json={"source_dir": str(source_tree), "target_dir": str(target)},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["files_scanned"] == 3
    assert body["files_migrated"] == 3
    assert body["bytes_migrated"] > 0
    assert (target / "forge.ini").read_text() == "[a]\nb=1\n"
    assert (target / "sub" / "inv.yaml").exists()
    assert not (target / "ignore.txt").exists()


@pytest.mark.asyncio
async def test_migrate_rejects_missing_source(tmp_path) -> None:
    async with _client() as client:
        response = await client.post(
            "/api/v1/settings/paths/migrate",
            json={"source_dir": str(tmp_path / "nope"), "target_dir": str(tmp_path / "dst")},
        )

    assert response.status_code == 400
