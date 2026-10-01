from __future__ import annotations

import stat
import sys
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.config import get_settings
from api.app.main import app
from api.app.routers import audit
from api.app.routers.audit import reset_audit_logs_for_tests
from api.app.services.ipam import parse_ipam_list, parse_reconcile, reset_mock_ledger_for_tests


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
def mock_env(monkeypatch):
    monkeypatch.setenv("FORGE_MOCK_MODE", "true")
    get_settings.cache_clear()
    reset_mock_ledger_for_tests()
    reset_audit_logs_for_tests()
    yield
    reset_mock_ledger_for_tests()
    get_settings.cache_clear()


LIST_OUTPUT = """\x1b[1mSLOT\x1b[0m            CP-VIP          METALLB                      STATE    CLUSTER
10.0.0.11       10.0.0.11       10.0.0.50-10.0.0.60          in-use   amd-nkp1
10.0.0.21       10.0.0.21       10.0.0.61-10.0.0.70          free     —

Capacity: 1/2 slots in use, 1 free
"""

RECONCILE_OUTPUT = """VMID ledger reconciliation — lab amd-lab

claimed-but-not-live (ledger reserves it, no live VM — stale reservation?):
  - VMID 1004

live-but-not-claimed (live VM the ledger does NOT reserve — collision risk):
  - VMID 1201 (orphan-vm-01)
"""


@pytest.fixture
def live_env(tmp_path, monkeypatch):
    """Live mode against a fake `forge` script that logs its argv and replays canned output."""
    home = tmp_path / "forge-home"
    lab_dir = home / "labs" / "amd-lab"
    lab_dir.mkdir(parents=True)
    (lab_dir / "amd-lab-infra.ini").write_text('LAB_NAME="amd-lab"\nLAB_IP_POOL="10.0.0.10-10.0.0.40"\n')
    calls = tmp_path / "calls.log"
    (tmp_path / "list.txt").write_text(LIST_OUTPUT)
    (tmp_path / "reconcile.txt").write_text(RECONCILE_OUTPUT)
    script = tmp_path / "forge"
    script.write_text(
        "#!/bin/bash\n"
        f'echo "$@" >> "{calls}"\n'
        'case "$2" in\n'
        f'  list|free) cat "{tmp_path}/list.txt" ;;\n'
        f'  reconcile-vmids) cat "{tmp_path}/reconcile.txt" ;;\n'
        "  release) echo released ;;\n"
        "esac\n"
    )
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    monkeypatch.delenv("FORGE_MOCK_MODE", raising=False)
    monkeypatch.setenv("FORGE_HOME", str(home))
    get_settings.cache_clear()
    reset_audit_logs_for_tests()
    monkeypatch.setattr(app.state.process_runner, "_forge_bin", script)
    yield calls, lab_dir / "amd-lab-infra.ini"
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_mock_ledger_has_all_slot_kinds_and_consistent_totals(mock_env) -> None:
    async with _client() as client:
        response = await client.get("/api/v1/ipam")

    body = response.json()
    assert response.status_code == 200
    assert body["ip_pool"] == "10.0.0.10-10.0.0.40"
    assert body["total_slots"] == 31 == len(body["slots"])
    assert body["allocated_slots"] + body["free_slots"] == body["total_slots"]
    assert body["updated_at"].endswith("Z")
    assert body["slots"][0]["ip"] == "10.0.0.10" and body["slots"][-1]["ip"] == "10.0.0.40"
    by_status = {s["status"] for s in body["slots"]}
    assert by_status == {"allocated", "free", "vip", "gateway"}
    vip = next(s for s in body["slots"] if s["status"] == "vip" and s["cluster"] == "amd-nkp1")
    assert vip["role"] == "control-plane-vip"
    node = next(s for s in body["slots"] if s["hostname"] == "amd-nkp1-cp-01")
    assert node["vmid"] == 1001 and node["status"] == "allocated"


@pytest.mark.asyncio
async def test_free_endpoint_returns_only_unassigned_slots(mock_env) -> None:
    async with _client() as client:
        ledger = (await client.get("/api/v1/ipam")).json()
        response = await client.get("/api/v1/ipam/free")

    free = response.json()
    assert response.status_code == 200
    assert len(free) == ledger["free_slots"] > 0
    assert all(s["status"] == "free" and s["cluster"] is None for s in free)


@pytest.mark.asyncio
async def test_release_frees_cluster_slots_and_audits(mock_env) -> None:
    async with _client() as client:
        before = (await client.get("/api/v1/ipam")).json()
        response = await client.post(
            "/api/v1/ipam/release", json={"cluster_name": "amd-nkp1"}, headers={"X-Forge-Role": "operator"}
        )
        after = (await client.get("/api/v1/ipam")).json()

    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "released"
    assert body["cluster_name"] == "amd-nkp1"
    assert body["released_count"] == 4
    assert body["safety_backup_id"]
    assert after["free_slots"] == before["free_slots"] + 4
    assert not [s for s in after["slots"] if s["cluster"] == "amd-nkp1"]
    assert any(s["cluster"] == "cirra-nkp1" for s in after["slots"])

    event = next(e for e in audit.AUDIT_LOG_STATE if e["verb"] == "ipam-released")
    assert event["details"]["cluster_name"] == "amd-nkp1"
    assert event["details"]["released_count"] == 4


@pytest.mark.asyncio
async def test_release_admin_allowed_viewer_forbidden_unknown_cluster_404(mock_env) -> None:
    async with _client() as client:
        viewer = await client.post(
            "/api/v1/ipam/release", json={"cluster_name": "amd-nkp1"}, headers={"X-Forge-Role": "viewer"}
        )
        unknown = await client.post(
            "/api/v1/ipam/release", json={"cluster_name": "ghost-cluster"}, headers={"X-Forge-Role": "admin"}
        )
        admin = await client.post(
            "/api/v1/ipam/release", json={"cluster_name": "cirra-nkp1"}, headers={"X-Forge-Role": "admin"}
        )
        again = await client.post(
            "/api/v1/ipam/release", json={"cluster_name": "cirra-nkp1"}, headers={"X-Forge-Role": "admin"}
        )

    assert viewer.status_code == 403
    assert unknown.status_code == 404 and "ghost-cluster" in unknown.json()["detail"]
    assert admin.status_code == 200 and admin.json()["released_count"] == 3
    assert again.status_code == 404
    assert not any(e["verb"] == "ipam-released" and e["details"]["cluster_name"] == "amd-nkp1" for e in audit.AUDIT_LOG_STATE)


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["", "bad name", "x;rm -rf /", "--force", "../etc"])
async def test_release_rejects_unsafe_cluster_names(mock_env, name) -> None:
    async with _client() as client:
        response = await client.post("/api/v1/ipam/release", json={"cluster_name": name})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_reconcile_reports_drift_in_mock_mode(mock_env) -> None:
    async with _client() as client:
        response = await client.post("/api/v1/ipam/reconcile")

    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "drift-detected"
    assert body["discrepancies_found"] == len(body["details"]) == 2
    assert {d["type"] for d in body["details"]} == {"claimed-but-not-live", "live-but-not-claimed"}


def test_parse_helpers() -> None:
    slots = parse_ipam_list(LIST_OUTPUT)
    assert [(s.ip, s.status, s.cluster) for s in slots] == [
        ("10.0.0.11", "vip", "amd-nkp1"),
        ("10.0.0.50-10.0.0.60", "allocated", "amd-nkp1"),
        ("10.0.0.21", "free", None),
    ]
    assert parse_reconcile(RECONCILE_OUTPUT) == [
        {"type": "claimed-but-not-live", "vmid": 1004},
        {"type": "live-but-not-claimed", "vmid": 1201, "hostname": "orphan-vm-01"},
    ]
    assert parse_reconcile("Ledger and live Proxmox state agree — no VMID drift.") == []


@pytest.mark.asyncio
async def test_live_mode_delegates_to_forge_cli_with_lab_conf(live_env) -> None:
    calls, conf = live_env
    async with _client() as client:
        ledger = (await client.get("/api/v1/ipam")).json()
        free = (await client.get("/api/v1/ipam/free")).json()
        reconcile = (await client.post("/api/v1/ipam/reconcile")).json()
        release = await client.post("/api/v1/ipam/release", json={"cluster_name": "amd-nkp1"})
        missing = await client.post("/api/v1/ipam/release", json={"cluster_name": "ghost"})

    assert ledger["ip_pool"] == "10.0.0.10-10.0.0.40"
    assert ledger["total_slots"] == 3 and ledger["free_slots"] == 1 and ledger["allocated_slots"] == 2
    assert len(free) == 3  # the fake CLI replays the same table for `free`
    assert reconcile["status"] == "drift-detected" and reconcile["discrepancies_found"] == 2
    assert release.status_code == 200 and release.json()["released_count"] == 2
    assert missing.status_code == 404

    logged = calls.read_text().splitlines()
    assert f"ipam list --conf {conf}" in logged
    assert f"ipam free --conf {conf}" in logged
    assert f"ipam reconcile-vmids --conf {conf}" in logged
    assert f"ipam release --cluster amd-nkp1 --force --conf {conf}" in logged
    assert not any("ghost --force" in line for line in logged)


@pytest.mark.asyncio
async def test_live_mode_cli_failure_returns_500(live_env, tmp_path, monkeypatch) -> None:
    failing = tmp_path / "bin" / "forge"
    failing.parent.mkdir()
    failing.write_text("#!/bin/bash\necho 'PVE unreachable' >&2\nexit 3\n")
    failing.chmod(failing.stat().st_mode | stat.S_IEXEC)
    monkeypatch.setattr(app.state.process_runner, "_forge_bin", failing)

    async with _client() as client:
        response = await client.get("/api/v1/ipam")

    assert response.status_code == 500
    assert response.json()["detail"] == "PVE unreachable"
