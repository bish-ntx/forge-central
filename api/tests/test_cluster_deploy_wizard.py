from __future__ import annotations

import asyncio
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.config import get_settings
from api.app.main import app
from api.app.routers.audit import reset_audit_logs_for_tests
from api.app.services.cluster_config import suggest_ip_plan
from api.app.services.ipam import parse_free_candidates, reset_mock_ledger_for_tests
from api.app.services.process_runner import ProcessRun, ProcessRunner, RunStatus, RunStep

ADMIN = {"X-Forge-Role": "admin"}
LAB = {
    "lab_name": "amd-lab",
    "pve_host": "10.0.0.5",
    "pve_node": "pve1",
    "storage_pool": "local-lvm",
    "network_bridge": "vmbr1",
    "nameserver": "10.0.0.1",
    "lab_ip_pool": "10.0.0.10-10.0.0.40",
    "pve_password": "s3cr3t-pw",
}
INIT = {
    "cluster_name": "wiz-nkp1",
    "lab_name": "amd-lab",
    "nkp_version": "v2.18.0",
    "registry_type": "harbor",
    "storage_mode": "local",
    "control_plane_nodes": 3,
    "worker_nodes": 4,
}


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture(autouse=True)
def wizard_env(tmp_path, monkeypatch):
    monkeypatch.setenv("FORGE_HOME", str(tmp_path / "forge"))
    monkeypatch.setenv("FORGE_STATE_DIR", str(tmp_path / "forge-state"))
    monkeypatch.setenv("FORGE_CENTRAL_IP", "10.0.0.2")
    monkeypatch.setenv("FORGE_MOCK_MODE", "true")
    get_settings.cache_clear()
    reset_mock_ledger_for_tests()
    reset_audit_logs_for_tests()
    yield tmp_path
    reset_mock_ledger_for_tests()
    get_settings.cache_clear()


async def _create_lab(client: AsyncClient) -> None:
    response = await client.post("/api/v1/lab/init", json=LAB, headers=ADMIN)
    assert response.status_code == 200


def _capture_sequence(monkeypatch) -> dict:
    captured: dict = {}

    async def fake_start_sequence(steps, env_overrides=None):
        captured["steps"] = steps
        return ProcessRun(
            run_id=uuid4(),
            command=" && ".join(step.display for step in steps),
            argv=[],
            status=RunStatus.PENDING,
            started_at=datetime.now(timezone.utc),
        )

    monkeypatch.setattr(app.state.process_runner, "start_sequence", fake_start_sequence)
    return captured


# ---------------------------------------------------------------------------
# init-config
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_init_config_nutanix_csi_inherits_lab_prism_with_cluster_override(wizard_env) -> None:
    prism_lab = {
        **LAB,
        "storage_mode": "nutanix-csi-pe",
        "prism_endpoint": "10.1.1.10",
        "prism_user": "admin",
        "prism_password": "Pr1sm-secret",
        "storage_container": "lab-container",
    }
    async with _client() as client:
        assert (await client.post("/api/v1/lab/init", json=prism_lab, headers=ADMIN)).status_code == 200
        inherited = await client.post(
            "/api/v1/clusters/init-config", json={**INIT, "storage_mode": "nutanix-csi-pe"}
        )
        override = await client.post(
            "/api/v1/clusters/init-config",
            json={**INIT, "storage_mode": "nutanix-csi-pc", "prism_endpoint": "10.9.9.9", "prism_port": 9442},
        )
        local = await client.post("/api/v1/clusters/init-config", json=INIT)

    first, second = inherited.json()["config_preview"], override.json()["config_preview"]
    assert 'PRISM_ENDPOINT="10.1.1.10"' in first and 'PRISM_PORT="9440"' in first
    assert 'STORAGE_CONTAINER="lab-container"' in first and 'PRISM_USER="admin"' in first
    assert 'PRISM_ENDPOINT="10.9.9.9"' in second and 'PRISM_PORT="9442"' in second
    assert "PRISM_" not in local.json()["config_preview"]
    assert "Pr1sm-secret" not in first + second  # the Prism password stays in the lab file


@pytest.mark.asyncio
async def test_init_config_writes_input_ini_inheriting_lab_and_audits(wizard_env) -> None:
    async with _client() as client:
        await _create_lab(client)
        response = await client.post("/api/v1/clusters/init-config", json=INIT)
        audit = await client.get("/api/v1/audit/logs", params={"verb": "cluster-config-initialized"})

    assert response.status_code == 200
    body = response.json()
    ini = wizard_env / "forge-state" / "wiz-nkp1" / "wiz-nkp1-input.ini"
    assert body["config_path"] == str(ini)
    assert body["status"] == "initialized" and body["lab_name"] == "amd-lab"
    assert stat.S_IMODE(ini.stat().st_mode) == 0o600

    text = ini.read_text()
    assert text == body["config_preview"]
    for expected in (
        'CLUSTER_NAME="wiz-nkp1"',
        'NKP_CLI_VERSION="v2.18.0"',
        'REGISTRY_TYPE="harbor"',
        'CONTROL_PLANE_COUNT="3"',
        'WORKER_COUNT="4"',
        'PVE_CLUSTER_HOST="10.0.0.5"',  # inherited from the lab
        'NETWORK_BRIDGE="vmbr1"',
        'STORAGE_POOL="local-lvm"',
        f'LAB_ENV="{wizard_env / "forge" / "labs" / "amd-lab" / "amd-lab-infra.ini"}"',
    ):
        assert expected in text
    assert "s3cr3t-pw" not in text and "PVE_PASSWORD" not in text

    # Mock ledger: 10.0.0.15 is the first free slot, 16-20 the free run right after it.
    assert body["vip_preview"] == "10.0.0.15" and body["metallb_range_preview"] == "10.0.0.16-10.0.0.20"
    assert 'KUBE_VIP="10.0.0.15"' in text and 'METALLB_RANGE="10.0.0.16-10.0.0.20"' in text
    assert body["free_ip_count"] > 0

    commands = body["commands"]
    assert commands[0].startswith("./forge init nkp-cluster --cluster wiz-nkp1 --lab-infra ")
    assert "--nkp-version v2.18.0" in commands[0] and "--non-interactive" in commands[0]
    assert commands[1] == f"./forge provision vms --skip-bastion --conf {ini}"
    assert commands[2] == f"./forge create cluster --conf {ini}"

    event = audit.json()["logs"][0]
    assert event["verb"] == "cluster-config-initialized"
    assert event["details"]["cluster_name"] == "wiz-nkp1" and event["details"]["lab_name"] == "amd-lab"
    assert event["details"]["vip"] == "10.0.0.15"
    assert "s3cr3t-pw" not in audit.text


@pytest.mark.asyncio
async def test_init_config_rerun_keeps_backup(wizard_env) -> None:
    async with _client() as client:
        await _create_lab(client)
        await client.post("/api/v1/clusters/init-config", json=INIT)
        again = await client.post("/api/v1/clusters/init-config", json={**INIT, "worker_nodes": 2})

    ini = wizard_env / "forge-state" / "wiz-nkp1" / "wiz-nkp1-input.ini"
    assert again.status_code == 200
    assert 'WORKER_COUNT="2"' in ini.read_text()
    assert 'WORKER_COUNT="4"' in ini.with_name(ini.name + ".bak").read_text()


@pytest.mark.asyncio
async def test_init_config_bastion_mode_records_central_ip_and_remote_commands(wizard_env) -> None:
    async with _client() as client:
        await _create_lab(client)
        response = await client.post(
            "/api/v1/clusters/init-config",
            json={**INIT, "target_runner": "bastion", "bastion_ip": "10.0.0.50"},
        )

    body = response.json()
    assert response.status_code == 200
    assert 'FORGE_CENTRAL_IP="10.0.0.2"' in body["config_preview"]
    assert body["commands"][1] == "./forge share mount --from 10.0.0.2 --target 10.0.0.50"
    assert body["commands"][2].startswith("ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new nkpadmin@10.0.0.50 ")
    assert "nkp-forge/forge provision vms --skip-bastion --conf forge-state/wiz-nkp1/wiz-nkp1-input.ini" in body["commands"][2]
    assert "nkp-forge/forge create cluster --conf forge-state/wiz-nkp1/wiz-nkp1-input.ini" in body["commands"][3]


@pytest.mark.asyncio
async def test_init_config_validation_and_guards(wizard_env) -> None:
    async with _client() as client:
        unknown_lab = await client.post("/api/v1/clusters/init-config", json=INIT)  # no lab created yet
        await _create_lab(client)
        bad_name = await client.post("/api/v1/clusters/init-config", json={**INIT, "cluster_name": "../etc"})
        no_bastion = await client.post("/api/v1/clusters/init-config", json={**INIT, "target_runner": "bastion"})
        bad_runner = await client.post("/api/v1/clusters/init-config", json={**INIT, "target_runner": "laptop"})
        bad_registry = await client.post("/api/v1/clusters/init-config", json={**INIT, "registry_type": "ftp"})
        viewer = await client.post("/api/v1/clusters/init-config", json=INIT, headers={"X-Forge-Role": "viewer"})

    assert unknown_lab.status_code == 404
    assert bad_name.status_code == 422
    assert no_bastion.status_code == 422
    assert bad_runner.status_code == 422
    assert bad_registry.status_code == 422
    assert viewer.status_code == 403
    assert not (wizard_env / "forge-state" / "wiz-nkp1").exists()


@pytest.mark.asyncio
async def test_lab_config_exposes_nkp_version_for_inheritance(wizard_env) -> None:
    lab_dir = wizard_env / "forge" / "labs" / "amd-lab"
    lab_dir.mkdir(parents=True)
    (lab_dir / "amd-lab-infra.ini").write_text('LAB_NAME="amd-lab"\nNKP_CLI_VERSION="v2.18.0"\nSTORAGE_POOL="tank"\n')
    async with _client() as client:
        response = await client.get("/api/v1/lab/config", params={"lab": "amd-lab"})

    assert response.json()["nkp_version"] == "v2.18.0" and response.json()["storage_pool"] == "tank"


# ---------------------------------------------------------------------------
# IPAM candidate selection
# ---------------------------------------------------------------------------
def test_suggest_ip_plan_prefers_run_after_vip_and_caps_block_size() -> None:
    free = [(f"10.0.0.{n}", None) for n in (15, 16, 17, 18, 19, 20, 21, 22, 30)]
    assert suggest_ip_plan(free) == ("10.0.0.15", "10.0.0.16-10.0.0.20")


def test_suggest_ip_plan_falls_back_to_next_contiguous_run_and_handles_empty() -> None:
    free = [(f"10.0.0.{n}", None) for n in (15, 20, 21, 22)]
    assert suggest_ip_plan(free) == ("10.0.0.15", "10.0.0.20-10.0.0.22")
    assert suggest_ip_plan([("10.0.0.15", None)]) == ("10.0.0.15", None)
    assert suggest_ip_plan([]) == (None, None)


def test_suggest_ip_plan_uses_ledger_metallb_range_when_present() -> None:
    assert suggest_ip_plan([("10.0.0.21", "10.0.0.61-10.0.0.70")]) == ("10.0.0.21", "10.0.0.61-10.0.0.70")


def test_parse_free_candidates_reads_vip_and_metallb_columns() -> None:
    output = (
        "SLOT  CP-VIP  METALLB  STATE  CLUSTER\n"
        "10.0.0.11 10.0.0.11 10.0.0.50-10.0.0.60 in-use amd\n"
        "10.0.0.21 10.0.0.21 10.0.0.61-10.0.0.70 free —\n"
        "10.0.0.31 10.0.0.31 — free —\n"
    )
    assert parse_free_candidates(output) == [("10.0.0.21", "10.0.0.61-10.0.0.70"), ("10.0.0.31", None)]


# ---------------------------------------------------------------------------
# sync-bastion
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sync_bastion_requires_generated_config(wizard_env) -> None:
    async with _client() as client:
        response = await client.post(
            "/api/v1/clusters/sync-bastion", json={"cluster_name": "wiz-nkp1", "bastion_ip": "10.0.0.50"}
        )

    assert response.status_code == 404
    assert "init-config" in response.json()["detail"]


@pytest.mark.asyncio
async def test_sync_bastion_queues_nfs_share_mount_and_audits(wizard_env, monkeypatch) -> None:
    captured = _capture_sequence(monkeypatch)
    async with _client() as client:
        await _create_lab(client)
        await client.post("/api/v1/clusters/init-config", json=INIT)
        response = await client.post(
            "/api/v1/clusters/sync-bastion", json={"cluster_name": "wiz-nkp1", "bastion_ip": "10.0.0.50"}
        )
        audit = await client.get("/api/v1/audit/logs", params={"verb": "cluster-bastion-sync"})

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "queued" and body["bastion_ip"] == "10.0.0.50" and body["cluster_name"] == "wiz-nkp1"
    assert body["run_id"]
    [step] = captured["steps"]
    assert step.argv == ["share", "mount", "--from", "10.0.0.2", "--target", "10.0.0.50"]
    assert not step.external
    assert body["steps"] == ["./forge share mount --from 10.0.0.2 --target 10.0.0.50"]
    assert audit.json()["logs"][0]["details"]["bastion_ip"] == "10.0.0.50"


@pytest.mark.asyncio
async def test_sync_bastion_without_nfs_uses_ssh_mkdir_and_scp(wizard_env, monkeypatch) -> None:
    captured = _capture_sequence(monkeypatch)
    async with _client() as client:
        await _create_lab(client)
        await client.post("/api/v1/clusters/init-config", json=INIT)
        response = await client.post(
            "/api/v1/clusters/sync-bastion",
            json={"cluster_name": "wiz-nkp1", "bastion_ip": "bastion-01", "nfs_mount": False},
        )

    assert response.status_code == 202
    mkdir, scp = captured["steps"]
    assert mkdir.external and mkdir.argv[0] == "ssh" and mkdir.argv[-1] == "mkdir -p forge-state/wiz-nkp1"
    assert scp.external and scp.argv[0] == "scp"
    assert scp.argv[-2].endswith("wiz-nkp1/wiz-nkp1-input.ini")
    assert scp.argv[-1] == "nkpadmin@bastion-01:forge-state/wiz-nkp1/wiz-nkp1-input.ini"


@pytest.mark.asyncio
async def test_sync_bastion_rejects_unsafe_host_and_viewer(wizard_env) -> None:
    async with _client() as client:
        injected = await client.post(
            "/api/v1/clusters/sync-bastion", json={"cluster_name": "wiz-nkp1", "bastion_ip": "-oProxyCommand=x"}
        )
        spaced = await client.post(
            "/api/v1/clusters/sync-bastion", json={"cluster_name": "wiz-nkp1", "bastion_ip": "1.2.3.4; rm -rf /"}
        )
        viewer = await client.post(
            "/api/v1/clusters/sync-bastion",
            json={"cluster_name": "wiz-nkp1", "bastion_ip": "10.0.0.50"},
            headers={"X-Forge-Role": "viewer"},
        )

    assert injected.status_code == 422 and spaced.status_code == 422
    assert viewer.status_code == 403


# ---------------------------------------------------------------------------
# create (wizard flow)
# ---------------------------------------------------------------------------
CREATE = {"cluster_name": "wiz-nkp1", "lab_name": "amd-lab", "kubernetes_version": "v1.31.1"}


@pytest.mark.asyncio
async def test_create_from_wizard_chains_provision_and_create_on_central(wizard_env, monkeypatch) -> None:
    captured = _capture_sequence(monkeypatch)
    async with _client() as client:
        await _create_lab(client)
        await client.post("/api/v1/clusters/init-config", json=INIT)
        response = await client.post("/api/v1/clusters/create", json=CREATE)
        audit = await client.get("/api/v1/audit/logs", params={"verb": "cluster-create-dispatched"})

    ini = str(wizard_env / "forge-state" / "wiz-nkp1" / "wiz-nkp1-input.ini")
    assert response.status_code == 202
    assert response.json()["steps"] == ["Provision VMs", "Create cluster"]
    provision, create = captured["steps"]
    assert provision.argv == ["provision", "vms", "--skip-bastion", "--conf", ini]
    assert create.argv == ["create", "cluster", "--conf", ini]
    assert audit.json()["logs"][0]["details"]["target_runner"] == "central"


@pytest.mark.asyncio
async def test_create_from_wizard_on_bastion_syncs_then_runs_over_ssh(wizard_env, monkeypatch) -> None:
    captured = _capture_sequence(monkeypatch)
    async with _client() as client:
        await _create_lab(client)
        await client.post("/api/v1/clusters/init-config", json=INIT)
        response = await client.post(
            "/api/v1/clusters/create", json={**CREATE, "target_runner": "bastion", "bastion_ip": "10.0.0.50"}
        )

    assert response.status_code == 202
    assert response.json()["steps"] == [
        "Sync config to bastion (NFS share mount)",
        "Provision VMs (bastion)",
        "Create cluster (bastion)",
    ]
    sync, provision, create = captured["steps"]
    assert sync.argv == ["share", "mount", "--from", "10.0.0.2", "--target", "10.0.0.50"]
    assert provision.external and provision.argv[-1] == (
        "nkp-forge/forge provision vms --skip-bastion --conf forge-state/wiz-nkp1/wiz-nkp1-input.ini"
    )
    assert create.argv[-1] == "nkp-forge/forge create cluster --conf forge-state/wiz-nkp1/wiz-nkp1-input.ini"


@pytest.mark.asyncio
async def test_create_from_wizard_validation(wizard_env, monkeypatch) -> None:
    _capture_sequence(monkeypatch)
    async with _client() as client:
        await _create_lab(client)
        missing_config = await client.post("/api/v1/clusters/create", json=CREATE)
        await client.post("/api/v1/clusters/init-config", json=INIT)
        no_bastion_ip = await client.post("/api/v1/clusters/create", json={**CREATE, "target_runner": "bastion"})
        bad_name = await client.post("/api/v1/clusters/create", json={**CREATE, "cluster_name": "a b"})
        viewer = await client.post("/api/v1/clusters/create", json=CREATE, headers={"X-Forge-Role": "viewer"})

    assert missing_config.status_code == 404
    assert no_bastion_ip.status_code == 400
    assert bad_name.status_code == 400
    assert viewer.status_code == 403


# ---------------------------------------------------------------------------
# ProcessRunner.start_sequence (live subprocess against a fake forge)
# ---------------------------------------------------------------------------
async def _wait_done(run: ProcessRun) -> None:
    for _ in range(200):
        if run.status in (RunStatus.COMPLETED, RunStatus.FAILED):
            return
        await asyncio.sleep(0.02)
    raise AssertionError("run did not finish")


def _drain(run: ProcessRun) -> list[dict]:
    items = []
    while not run.events.empty():
        items.append(run.events.get_nowait())
    return items


def _fake_forge(tmp_path: Path, fail_on: str = "") -> Path:
    forge = tmp_path / "bin" / "forge"
    forge.parent.mkdir()
    forge.write_text(
        "#!/bin/sh\n"
        f'echo "$@" >> "{tmp_path}/calls.log"\n'
        'echo "forge ran: $@"\n'
        f'if [ -n "{fail_on}" ] && [ "$1 $2" = "{fail_on}" ]; then echo boom >&2; exit 3; fi\n'
    )
    forge.chmod(0o755)
    return forge


@pytest.mark.asyncio
async def test_start_sequence_runs_steps_in_order_and_streams_progress(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("FORGE_MOCK_MODE", "false")
    get_settings.cache_clear()
    runner = ProcessRunner(forge_bin=_fake_forge(tmp_path))
    run = await runner.start_sequence(
        [
            RunStep(argv=["provision", "vms", "--conf", "x.ini"], label="Provision VMs"),
            RunStep(argv=["create", "cluster", "--conf", "x.ini"], label="Create cluster"),
        ]
    )
    await _wait_done(run)

    assert run.status == RunStatus.COMPLETED and run.exit_code == 0
    assert (tmp_path / "calls.log").read_text().splitlines() == [
        "provision vms --conf x.ini",
        "create cluster --conf x.ini",
    ]
    lines = [e["line"] for e in _drain(run) if e["event"] == "log"]
    assert "==> Step 1/2: Provision VMs" in lines and "==> Step 2/2: Create cluster" in lines
    assert any(line.startswith("[TIMESTAMP] UTC:") for line in lines)
    assert "forge ran: create cluster --conf x.ini" in lines


@pytest.mark.asyncio
async def test_start_sequence_stops_at_first_failing_step(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("FORGE_MOCK_MODE", "false")
    get_settings.cache_clear()
    runner = ProcessRunner(forge_bin=_fake_forge(tmp_path, fail_on="provision vms"))
    run = await runner.start_sequence(
        [
            RunStep(argv=["provision", "vms"], label="Provision VMs"),
            RunStep(argv=["create", "cluster"], label="Create cluster"),
        ]
    )
    await _wait_done(run)

    assert run.status == RunStatus.FAILED and run.exit_code == 3
    assert (tmp_path / "calls.log").read_text().splitlines() == ["provision vms"]
    lines = [e["line"] for e in _drain(run) if e["event"] == "log"]
    assert "step 1/2 failed with exit code 3" in lines


@pytest.mark.asyncio
async def test_start_sequence_mock_mode_simulates_without_executing(tmp_path) -> None:
    runner = ProcessRunner(forge_bin=_fake_forge(tmp_path), mock_mode=True)
    run = await runner.start_sequence([RunStep(argv=["create", "cluster"], label="Create cluster")])
    await _wait_done(run)

    assert run.status == RunStatus.COMPLETED
    assert not (tmp_path / "calls.log").exists()
    assert any("[mock]" in e["line"] for e in _drain(run) if e["event"] == "log")


@pytest.mark.asyncio
async def test_start_sequence_rejects_non_allowlisted_external_commands(tmp_path) -> None:
    runner = ProcessRunner(forge_bin=_fake_forge(tmp_path))
    with pytest.raises(ValueError):
        await runner.start_sequence([RunStep(argv=["rm", "-rf", "/"], external=True)])
    with pytest.raises(ValueError):
        await runner.start_sequence([])
