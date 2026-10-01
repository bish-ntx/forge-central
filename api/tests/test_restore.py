from __future__ import annotations

import hashlib
import io
import sys
import tarfile
from pathlib import Path

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
def restore_env(tmp_path, monkeypatch):
    data = tmp_path / "data"
    data.mkdir()
    (data / "forge.ini").write_text("[a]\nb=1\n")
    (data / "forge-central.db").write_bytes(b"sqlite-v1")
    (tmp_path / "cacrt").mkdir()
    (tmp_path / "cacrt" / "ca.crt").write_text("cert-v1")
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("FORGE_CENTRAL_DATA_DIR", str(data))
    monkeypatch.setenv("FORGE_BACKUP_DIR", str(tmp_path / "backups"))
    get_settings.cache_clear()
    reset_audit_logs_for_tests()
    yield tmp_path
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_verify_returns_passing_checks(restore_env) -> None:
    async with _client() as client:
        backup = (await client.post("/api/v1/backup/create")).json()
        response = await client.post("/api/v1/restore/verify", json={"backup_id": backup["backup_id"]})

    body = response.json()
    assert response.status_code == 200
    assert body["valid"] is True
    assert body["filename"] == backup["filename"]
    assert [c["name"] for c in body["checks"]] == ["archive-exists", "checksum-match", "archive-integrity"]
    assert all(c["passed"] for c in body["checks"])
    assert body["manifest"]["checksum_sha256"] == backup["checksum_sha256"]
    assert {"state", "cacrt", "forge-central.db"} <= set(body["manifest"]["entries"])


@pytest.mark.asyncio
async def test_verify_rejects_tampered_and_corrupt_archives(restore_env) -> None:
    async with _client() as client:
        tampered = (await client.post("/api/v1/backup/create")).json()
        archive = restore_env / "backups" / tampered["filename"]
        corrupt = restore_env / "backups" / "corrupt.tar.gz"
        corrupt.write_bytes(b"not a gzip")
        corrupt.with_name("corrupt.tar.gz.sha256").write_text("x")
        # Tamper: valid tarball whose bytes no longer match the recorded checksum.
        with tarfile.open(archive, "w:gz") as tar:
            info = tarfile.TarInfo("state/evil.ini")
            tar.addfile(info, io.BytesIO(b""))
        tampered_resp = (await client.post("/api/v1/restore/verify", json={"backup_id": tampered["backup_id"]})).json()
        corrupt_resp = (await client.post("/api/v1/restore/verify", json={"backup_id": "corrupt"})).json()
        missing_resp = (await client.post("/api/v1/restore/verify", json={"backup_id": "../../etc/passwd"})).json()
        execute = await client.post("/api/v1/restore/execute", json={"backup_id": tampered["backup_id"]})

    assert tampered_resp["valid"] is False
    assert {c["name"]: c["passed"] for c in tampered_resp["checks"]}["checksum-match"] is False
    assert corrupt_resp["valid"] is False
    assert {c["name"]: c["passed"] for c in corrupt_resp["checks"]}["archive-integrity"] is False
    assert missing_resp["valid"] is False and missing_resp["filename"] == "passwd.tar.gz"
    assert execute.status_code == 400
    assert not (restore_env / "data" / "evil.ini").exists()


@pytest.mark.asyncio
async def test_execute_restores_files_creates_safety_backup_and_audits(restore_env) -> None:
    data = restore_env / "data"
    async with _client() as client:
        backup = (await client.post("/api/v1/backup/create")).json()
        (data / "forge.ini").write_text("[a]\nb=CHANGED\n")
        (data / "forge-central.db").write_bytes(b"sqlite-v2")
        (restore_env / "cacrt" / "ca.crt").write_text("cert-v2")
        response = await client.post("/api/v1/restore/execute", json={"backup_id": backup["backup_id"]})
        listed = (await client.get("/api/v1/backup/list")).json()["backups"]

    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "completed"
    assert body["restored_files_count"] >= 3
    assert body["safety_backup_id"] != backup["backup_id"]
    assert body["safety_backup_id"] in {item["backup_id"] for item in listed}
    assert (data / "forge.ini").read_text() == "[a]\nb=1\n"
    assert (data / "forge-central.db").read_bytes() == b"sqlite-v1"
    assert (restore_env / "cacrt" / "ca.crt").read_text() == "cert-v1"
    assert not list(data.glob("*.restore-tmp"))

    event = next(e for e in audit.AUDIT_LOG_STATE if e["verb"] == "state-restored")
    assert event["run_id"] == body["restore_id"]
    assert event["details"]["safety_backup_id"] == body["safety_backup_id"]


@pytest.mark.asyncio
async def test_execute_strips_path_traversal_members(restore_env) -> None:
    backups = restore_env / "backups"
    backups.mkdir()
    archive = backups / "evil.tar.gz"
    with tarfile.open(archive, "w:gz") as tar:
        for name in ("state/ok.ini", "state/../../escaped.txt", "/abs.txt"):
            info = tarfile.TarInfo(name)
            info.size = 2
            tar.addfile(info, io.BytesIO(b"hi"))
    archive.with_name("evil.tar.gz.sha256").write_text(hashlib.sha256(archive.read_bytes()).hexdigest() + "\n")

    async with _client() as client:
        response = await client.post("/api/v1/restore/execute", json={"backup_id": "evil"})

    assert response.status_code == 200
    assert response.json()["restored_files_count"] == 1
    assert (restore_env / "data" / "ok.ini").read_text() == "hi"
    assert not (restore_env / "escaped.txt").exists()
