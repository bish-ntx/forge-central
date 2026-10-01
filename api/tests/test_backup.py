from __future__ import annotations

import hashlib
import tarfile
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
def backup_env(tmp_path, monkeypatch):
    data = tmp_path / "data"
    data.mkdir()
    (data / "forge.ini").write_text("[a]\nb=1\n")
    (data / "run.log").write_text("noisy\n")
    (data / "forge-central.db").write_bytes(b"sqlite")
    (tmp_path / "cacrt").mkdir()
    (tmp_path / "cacrt" / "ca.crt").write_text("cert")
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("FORGE_CENTRAL_DATA_DIR", str(data))
    monkeypatch.setenv("FORGE_BACKUP_DIR", str(tmp_path / "backups"))
    get_settings.cache_clear()
    reset_audit_logs_for_tests()
    yield tmp_path / "backups"
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_create_backup_archives_state_and_excludes_logs(backup_env) -> None:
    async with _client() as client:
        response = await client.post("/api/v1/backup/create")

    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "completed"
    assert body["filename"].startswith("forge-central-backup-") and body["filename"].endswith(".tar.gz")
    archive = backup_env / body["filename"]
    assert body["checksum_sha256"] == hashlib.sha256(archive.read_bytes()).hexdigest()
    assert body["file_size_bytes"] == archive.stat().st_size

    with tarfile.open(archive) as tar:
        names = tar.getnames()
    assert "state/forge.ini" in names
    assert "cacrt/ca.crt" in names
    assert "forge-central.db" in names
    assert not any(name.endswith(".log") for name in names)

    event = audit.AUDIT_LOG_STATE[0]
    assert event["verb"] == "backup-created"
    assert event["details"]["checksum"] == body["checksum_sha256"]
    assert event["details"]["size"] == body["file_size_bytes"]


@pytest.mark.asyncio
async def test_list_backups_returns_created_backup_newest_first(backup_env) -> None:
    async with _client() as client:
        empty = await client.get("/api/v1/backup/list")
        first = (await client.post("/api/v1/backup/create")).json()
        second = (await client.post("/api/v1/backup/create")).json()
        listed = await client.get("/api/v1/backup/list")

    assert empty.json() == {"backups": []}
    backups = listed.json()["backups"]
    assert {item["filename"] for item in backups} == {first["filename"], second["filename"]}
    assert backups[0]["created_at"] >= backups[1]["created_at"]
    assert all(item["checksum_sha256"] for item in backups)
