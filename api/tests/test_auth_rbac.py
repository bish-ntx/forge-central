from __future__ import annotations

from pathlib import Path
import sys

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.config import get_settings
from api.app.main import app


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
def stub_runner(monkeypatch: pytest.MonkeyPatch) -> list[list[str]]:
    """Replace the CLI runner so permitted calls never spawn a subprocess."""
    from api.tests.test_clusters import _pending_run

    calls: list[list[str]] = []

    async def fake_start_run(command, args, env_overrides=None):
        calls.append(args)
        return _pending_run("./forge stub")

    monkeypatch.setattr(app.state.process_runner, "start_run", fake_start_run)
    return calls


@pytest.mark.asyncio
async def test_unlock_admin_accepts_default_passphrase() -> None:
    async with _client() as client:
        response = await client.post("/api/v1/auth/unlock-admin", json={"passphrase": "Nutanix.123"})

    assert response.status_code == 200
    assert response.json() == {"status": "authorized", "role": "admin"}


@pytest.mark.asyncio
async def test_unlock_admin_rejects_wrong_passphrase() -> None:
    async with _client() as client:
        response = await client.post("/api/v1/auth/unlock-admin", json={"passphrase": "wrong"})

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_unlock_admin_honours_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGE_ADMIN_PASSWORD", "s3cret-phrase")
    get_settings.cache_clear()
    async with _client() as client:
        ok = await client.post("/api/v1/auth/unlock-admin", json={"passphrase": "s3cret-phrase"})
        old = await client.post("/api/v1/auth/unlock-admin", json={"passphrase": "Nutanix.123"})

    assert ok.status_code == 200
    assert old.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "url", "body"),
    [
        ("DELETE", "/api/v1/clusters/nkp-prod-01", None),
        ("POST", "/api/v1/clusters/nkp-prod-01/reset-nodes", None),
        ("POST", "/api/v1/vms/batch-action", {"vmids": [101], "action": "destroy"}),
        ("POST", "/api/v1/settings/paths/migrate", {"source_dir": "/a", "target_dir": "/b", "dry_run": True}),
    ],
)
async def test_viewer_role_is_forbidden_on_mutating_endpoints(stub_runner, method, url, body) -> None:
    async with _client() as client:
        response = await client.request(method, url, json=body, headers={"X-Forge-Role": "viewer"})

    assert response.status_code == 403
    assert response.json()["detail"] == "Viewer role cannot perform mutating actions"
    assert stub_runner == []


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["operator", "admin", None])
async def test_non_viewer_roles_can_run_destructive_endpoints(stub_runner, role) -> None:
    headers = {"X-Forge-Role": role} if role else {}
    async with _client() as client:
        delete = await client.delete("/api/v1/clusters/nkp-prod-01", headers=headers)
        reset = await client.post("/api/v1/clusters/nkp-prod-01/reset-nodes", headers=headers)
        destroy = await client.post(
            "/api/v1/vms/batch-action", json={"vmids": [101], "action": "destroy"}, headers=headers
        )

    assert (delete.status_code, reset.status_code, destroy.status_code) == (202, 202, 202)
    assert len(stub_runner) == 3
