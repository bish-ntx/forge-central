from __future__ import annotations

import stat
from pathlib import Path
import sys

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.config import get_settings
from api.app.main import app
ADMIN = {"X-Forge-Role": "admin"}
LAB = {
    "lab_name": "amd-lab",
    "pve_host": "10.0.0.5",
    "pve_node": "pve1",
    "storage_pool": "local-lvm",
    "nameserver": "10.0.0.1",
    "lab_ip_pool": "10.0.0.10-10.0.0.40",
    "pve_password": "p@ss$word",
}


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture(autouse=True)
def dirs(tmp_path, monkeypatch):
    monkeypatch.setenv("FORGE_HOME", str(tmp_path / "forge"))
    monkeypatch.setenv("FORGE_CACRT_DIR", str(tmp_path / "cacrt"))
    get_settings.cache_clear()
    yield tmp_path
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_lab_config_defaults_when_no_lab_exists() -> None:
    async with _client() as client:
        response = await client.get("/api/v1/lab/config")

    assert response.status_code == 200
    assert response.json()["configured"] is False
    assert response.json()["labs"] == []


@pytest.mark.asyncio
async def test_lab_init_writes_ini_and_config_roundtrips(dirs) -> None:
    async with _client() as client:
        init = await client.post("/api/v1/lab/init", json=LAB, headers=ADMIN)
        config = await client.get("/api/v1/lab/config")
        audit = await client.get("/api/v1/audit/logs", params={"verb": "lab-initialized"})

    ini = dirs / "forge" / "labs" / "amd-lab" / "amd-lab-infra.ini"
    assert init.status_code == 200
    assert init.json()["config_path"] == str(ini)
    assert stat.S_IMODE(ini.stat().st_mode) == 0o600
    assert 'PVE_CLUSTER_HOST="10.0.0.5"' in ini.read_text()
    assert 'PLATFORM="proxmox"' in ini.read_text()
    body = config.json()
    assert body["configured"] is True and body["labs"] == ["amd-lab"]
    assert (body["pve_host"], body["pve_node"], body["lab_ip_pool"]) == ("10.0.0.5", "pve1", "10.0.0.10-10.0.0.40")
    assert body["golden_vmid"] == 100 and body["network_bridge"] == "vmbr0"
    assert body["has_password"] is True and "pve_password" not in body
    assert audit.json()["logs"][0]["details"]["lab_name"] == "amd-lab"
    assert "p@ss" not in audit.text


@pytest.mark.asyncio
async def test_lab_init_keeps_existing_password_and_backs_up(dirs) -> None:
    async with _client() as client:
        await client.post("/api/v1/lab/init", json=LAB, headers=ADMIN)
        update = {k: v for k, v in LAB.items() if k != "pve_password"} | {"pve_node": "pve2"}
        await client.post("/api/v1/lab/init", json=update, headers=ADMIN)
        config = await client.get("/api/v1/lab/config", params={"lab": "amd-lab"})

    assert config.json()["pve_node"] == "pve2" and config.json()["has_password"] is True
    assert (dirs / "forge" / "labs" / "amd-lab" / "amd-lab-infra.ini.bak").is_file()


PRISM = {
    "storage_mode": "nutanix-csi-pe",
    "prism_endpoint": "10.1.1.10",
    "prism_port": 9441,
    "prism_user": "admin",
    "prism_password": "Pr1$m-secret",
    "storage_container": "default-container",
}


@pytest.mark.asyncio
async def test_lab_prism_credentials_persist_and_mask_password(dirs) -> None:
    async with _client() as client:
        init = await client.post("/api/v1/lab/init", json={**LAB, **PRISM}, headers=ADMIN)
        config = await client.get("/api/v1/lab/config")
        audit = await client.get("/api/v1/audit/logs", params={"verb": "lab-initialized"})

    ini = dirs / "forge" / "labs" / "amd-lab" / "amd-lab-infra.ini"
    text = ini.read_text()
    assert init.status_code == 200 and stat.S_IMODE(ini.stat().st_mode) == 0o600
    for expected in (
        'PRISM_ENDPOINT="10.1.1.10"',
        'PRISM_PORT="9441"',
        'PRISM_USER="admin"',
        'PRISM_PASSWORD="Pr1\\$m-secret"',
        'STORAGE_CONTAINER="default-container"',
        'STORAGE_MODE="nutanix-csi-pe"',
    ):
        assert expected in text
    body = config.json()
    assert (body["prism_endpoint"], body["prism_port"], body["prism_user"]) == ("10.1.1.10", 9441, "admin")
    assert body["storage_container"] == "default-container" and body["storage_mode"] == "nutanix-csi-pe"
    assert body["prism_password"] == "***MASKED***"
    assert "Pr1" not in config.text and "Pr1" not in init.text and "Pr1" not in audit.text


@pytest.mark.asyncio
async def test_lab_prism_defaults_and_password_kept_on_blank_or_masked(dirs) -> None:
    async with _client() as client:
        await client.post("/api/v1/lab/init", json=LAB, headers=ADMIN)
        before = (await client.get("/api/v1/lab/config")).json()
        await client.post("/api/v1/lab/init", json={**LAB, **PRISM}, headers=ADMIN)
        await client.post("/api/v1/lab/init", json={**LAB, **PRISM, "prism_password": None, "prism_user": "ops"}, headers=ADMIN)
        await client.post("/api/v1/lab/init", json={**LAB, **PRISM, "prism_password": "***MASKED***"}, headers=ADMIN)
        after = (await client.get("/api/v1/lab/config")).json()

    assert before["prism_endpoint"] is None and before["prism_port"] == 9440 and before["prism_password"] is None
    assert after["prism_password"] == "***MASKED***"
    assert 'PRISM_PASSWORD="Pr1\\$m-secret"' in (dirs / "forge" / "labs" / "amd-lab" / "amd-lab-infra.ini").read_text()


@pytest.mark.asyncio
@pytest.mark.parametrize("override", [{"prism_port": 0}, {"prism_port": 70000}, {"prism_endpoint": 'h"; rm -rf /'}])
async def test_lab_init_rejects_invalid_prism_input(override, dirs) -> None:
    async with _client() as client:
        response = await client.post("/api/v1/lab/init", json={**LAB, **PRISM, **override}, headers=ADMIN)

    assert response.status_code == 422
    assert not (dirs / "forge").exists()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "override",
    [
        {"lab_name": "../evil"},
        {"lab_ip_pool": "10.0.0.10"},
        {"lab_ip_pool": "10.0.0.10-10.0.0.300"},
        {"nameserver": 'a"; rm -rf /; "'},
        {"registry_type": "nope"},
    ],
)
async def test_lab_init_rejects_invalid_input(override, dirs) -> None:
    async with _client() as client:
        response = await client.post("/api/v1/lab/init", json={**LAB, **override}, headers=ADMIN)

    assert response.status_code == 422
    assert not (dirs / "forge").exists()


@pytest.mark.asyncio
@pytest.mark.parametrize("headers", [{}, {"X-Forge-Role": "operator"}, {"X-Forge-Role": "viewer"}])
async def test_lab_init_requires_admin(headers, dirs) -> None:
    async with _client() as client:
        response = await client.post("/api/v1/lab/init", json=LAB, headers=headers)

    assert response.status_code == 403
    assert not (dirs / "forge").exists()


@pytest.mark.asyncio
async def test_lab_init_permission_error_returns_clean_500_json(dirs, monkeypatch) -> None:
    def _raise_permission_error(*_args, **_kwargs):
        raise PermissionError("Permission denied: '/forge-state/labs'")

    monkeypatch.setattr(Path, "mkdir", _raise_permission_error)
    async with _client() as client:
        response = await client.post("/api/v1/lab/init", json=LAB, headers=ADMIN)

    assert response.status_code == 500
    assert "Permission denied writing lab configuration" in response.json()["detail"]


@pytest.mark.asyncio
async def test_secret_save_list_masks_passwords_and_delete(dirs) -> None:
    async with _client() as client:
        dh = await client.post(
            "/api/v1/secrets/save", json={"sec_type": "dockerhub", "user": "bish", "password": "dckr_pat_SECRET"}, headers=ADMIN
        )
        ca = dirs / "ca.crt"
        ca.write_text("cert")
        hb = await client.post(
            "/api/v1/secrets/save",
            json={"sec_type": "harbor", "user": "nkpadmin", "password": "Hb$ecret", "cluster": "amd-nkp1", "ca_path": str(ca)},
            headers=ADMIN,
        )
        listing = await client.get("/api/v1/secrets")
        harbor_ini = (dirs / "cacrt" / "amd-nkp1" / "harbor-creds.ini").read_text()
        delete = await client.delete("/api/v1/secrets/harbor", params={"cluster": "amd-nkp1"}, headers=ADMIN)
        after = await client.get("/api/v1/secrets")
        audit = await client.get("/api/v1/audit/logs", params={"verb": "secret-saved"})

    dh_file = dirs / "cacrt" / "dockerhub" / "dockerhub-creds.ini"
    assert dh.status_code == 200 and hb.status_code == 200
    assert stat.S_IMODE(dh_file.stat().st_mode) == 0o600
    assert 'DOCKERHUB_URL="https://index.docker.io/v1/"' in dh_file.read_text()
    assert 'HARBOR_PASSWORD="Hb\\$ecret"' in harbor_ini
    items = {item["sec_type"]: item for item in listing.json()["secrets"]}
    assert items["dockerhub"]["user"] == "bish" and items["dockerhub"]["has_ca"] is False
    assert items["harbor"]["cluster"] == "amd-nkp1" and items["harbor"]["has_ca"] is True
    assert "SECRET" not in listing.text and "Hb$ecret" not in listing.text and "password_masked" in listing.text
    assert delete.status_code == 200
    assert [i["sec_type"] for i in after.json()["secrets"]] == ["dockerhub"]
    assert audit.json()["total_count"] >= 2 and "SECRET" not in audit.text and "Hb$ecret" not in audit.text


@pytest.mark.asyncio
async def test_secret_validation_and_missing_delete() -> None:
    async with _client() as client:
        no_cluster = await client.post(
            "/api/v1/secrets/save", json={"sec_type": "harbor", "user": "u", "password": "p"}, headers=ADMIN
        )
        bad_type = await client.post(
            "/api/v1/secrets/save", json={"sec_type": "ssh", "user": "u", "password": "p"}, headers=ADMIN
        )
        missing = await client.delete("/api/v1/secrets/dockerhub", headers=ADMIN)
        unknown = await client.delete("/api/v1/secrets/ssh", headers=ADMIN)

    assert (no_cluster.status_code, bad_type.status_code, missing.status_code, unknown.status_code) == (422, 422, 404, 400)


@pytest.mark.asyncio
@pytest.mark.parametrize("headers", [{}, {"X-Forge-Role": "operator"}, {"X-Forge-Role": "viewer"}])
async def test_secret_mutations_require_admin(headers, dirs) -> None:
    body = {"sec_type": "dockerhub", "user": "u", "password": "p"}
    async with _client() as client:
        save = await client.post("/api/v1/secrets/save", json=body, headers=headers)
        delete = await client.delete("/api/v1/secrets/dockerhub", headers=headers)
        listing = await client.get("/api/v1/secrets", headers=headers)

    assert (save.status_code, delete.status_code, listing.status_code) == (403, 403, 200)
    assert not (dirs / "cacrt").exists()
