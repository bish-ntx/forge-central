from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import sys
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.config import get_settings
from api.app.main import app
from api.app.services import passthrough as passthrough_service
from api.app.services.process_runner import ProcessRun, RunStatus

LSPCI_OUTPUT = """\
0000:00:00.0 Host bridge: Advanced Micro Devices, Inc. [AMD] Root Complex [1022:153a]
0000:ba:00.0 Display controller: Advanced Micro Devices, Inc. [AMD/ATI] Instinct MI350P [1002:75a0]
0000:bb:00.0 3D controller: NVIDIA Corporation H100 [10de:2330]
0000:c1:00.0 Ethernet controller: Pensando Systems DSC Ethernet Controller Pollara 400 [1dd8:1002]
0000:d0:00.0 Ethernet controller: Intel Corporation I350 Gigabit [8086:1521]
"""
PASSTHROUGH_LIST_OUTPUT = """\
VMID  NAME       STATE    SLOT      BDF            ROLE
301   gpu-wk-01  stopped  hostpci0  0000:ba:00.0   gpu
301   gpu-wk-01  stopped  hostpci1  0000:c1:00     nic
"""


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
def mock_mode(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("FORGE_MOCK_MODE", "true")
    get_settings.cache_clear()
    yield
    monkeypatch.undo()
    get_settings.cache_clear()


@pytest.fixture
def captured_run(monkeypatch: pytest.MonkeyPatch) -> dict:
    captured: dict = {}

    async def fake_start_run(command, args, env_overrides=None) -> ProcessRun:
        captured.update(command=command, args=args, env_overrides=env_overrides)
        return ProcessRun(
            run_id=uuid4(),
            command="./forge " + " ".join(args),
            argv=args,
            status=RunStatus.PENDING,
            started_at=datetime.now(timezone.utc),
        )

    monkeypatch.setattr(app.state.process_runner, "start_run", fake_start_run)
    return captured


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------
def test_parse_pci_devices_keeps_only_gpus_and_pensando_nics() -> None:
    devices = passthrough_service.parse_pci_devices(LSPCI_OUTPUT)
    assert [(d.pci_bdf, d.device_type, d.vendor) for d in devices] == [
        ("0000:ba:00.0", "gpu", "AMD"),
        ("0000:bb:00.0", "gpu", "NVIDIA"),
        ("0000:c1:00.0", "nic", "Pensando"),
    ]


def test_parse_pci_devices_adds_default_domain() -> None:
    devices = passthrough_service.parse_pci_devices(
        "ba:00.0 Display controller: Advanced Micro Devices, Inc. [AMD/ATI] Instinct MI350P"
    )
    assert devices[0].pci_bdf == "0000:ba:00.0"


def test_parse_passthrough_list_and_assignments_match_function_less_bdf() -> None:
    rows = passthrough_service.parse_passthrough_list(PASSTHROUGH_LIST_OUTPUT)
    assert [(r["vmid"], r["slot"], r["bdf"]) for r in rows] == [
        (301, "hostpci0", "0000:ba:00.0"),
        (301, "hostpci1", "0000:c1:00"),
    ]
    devices = passthrough_service.apply_assignments(passthrough_service.parse_pci_devices(LSPCI_OUTPUT), rows)
    by_bdf = {d.pci_bdf: d for d in devices}
    assert by_bdf["0000:ba:00.0"].assigned_vm_name == "gpu-wk-01"
    assert by_bdf["0000:c1:00.0"].assigned_vmid == 301
    assert by_bdf["0000:bb:00.0"].assigned_vmid is None


# ---------------------------------------------------------------------------
# GET /hardware/pci
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_hardware_pci_mock_mode_returns_mi350p_and_pollara_fixtures(mock_mode) -> None:
    async with _client() as client:
        response = await client.get("/api/v1/vms/hardware/pci")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_gpus"] == 4
    assert payload["total_nics"] == 4
    assert payload["discovered_at"].endswith("Z")
    devices = {d["pci_bdf"]: d for d in payload["pci_devices"]}
    assert "MI350P" in devices["0000:05:00.0"]["description"]
    assert devices["0000:05:00.0"]["vendor"] == "AMD"
    assert devices["0000:07:00.0"]["vendor"] == "Pensando"
    assert "Pollara" in devices["0000:07:00.0"]["description"]
    assert devices["0000:05:00.0"]["assigned_vmid"] == 301
    assert devices["0000:05:00.0"]["assigned_vm_name"] == "gpu-wk-01"
    assert devices["0000:65:00.0"]["assigned_vmid"] is None


@pytest.mark.asyncio
async def test_hardware_pci_live_mode_wraps_forge_discover_and_passthrough_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("FORGE_MOCK_MODE", raising=False)
    get_settings.cache_clear()
    calls: list[list[str]] = []

    async def fake_capture(argv: list[str]):
        calls.append(argv[1:])
        if argv[1:3] == ["discover", "hardware"]:
            return 0, LSPCI_OUTPUT, ""
        return 0, PASSTHROUGH_LIST_OUTPUT, ""

    monkeypatch.setattr(passthrough_service, "_capture", fake_capture)
    async with _client() as client:
        response = await client.get("/api/v1/vms/hardware/pci")
    get_settings.cache_clear()

    assert response.status_code == 200
    assert calls == [["discover", "hardware", "--details"], ["passthrough", "list"]]
    payload = response.json()
    assert (payload["total_gpus"], payload["total_nics"]) == (2, 1)
    devices = {d["pci_bdf"]: d for d in payload["pci_devices"]}
    assert devices["0000:ba:00.0"]["assigned_vm_name"] == "gpu-wk-01"


@pytest.mark.asyncio
async def test_hardware_pci_live_mode_falls_back_to_lspci(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FORGE_MOCK_MODE", raising=False)
    get_settings.cache_clear()
    monkeypatch.setattr(passthrough_service.shutil, "which", lambda _name: "/usr/bin/lspci")
    calls: list[list[str]] = []

    async def fake_capture(argv: list[str]):
        calls.append(argv[1:] if argv[0] != "/usr/bin/lspci" else argv)
        if argv[0] == "/usr/bin/lspci":
            return 0, LSPCI_OUTPUT, ""
        if argv[1:3] == ["discover", "hardware"]:
            return 1, "", "discover failed"
        return 1, "", ""

    monkeypatch.setattr(passthrough_service, "_capture", fake_capture)
    async with _client() as client:
        response = await client.get("/api/v1/vms/hardware/pci")
    get_settings.cache_clear()

    assert response.status_code == 200
    assert ["/usr/bin/lspci", "-D"] in calls
    assert response.json()["total_gpus"] == 2


@pytest.mark.asyncio
async def test_hardware_pci_live_mode_reports_500_when_discovery_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FORGE_MOCK_MODE", raising=False)
    get_settings.cache_clear()
    monkeypatch.setattr(passthrough_service.shutil, "which", lambda _name: None)

    async def fake_capture(_argv: list[str]):
        return 1, "", "forge: discover hardware failed"

    monkeypatch.setattr(passthrough_service, "_capture", fake_capture)
    async with _client() as client:
        response = await client.get("/api/v1/vms/hardware/pci")
    get_settings.cache_clear()

    assert response.status_code == 500
    assert response.json()["detail"] == "forge: discover hardware failed"


# ---------------------------------------------------------------------------
# attach / detach power-state guards
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_attach_stopped_vm_queues_forge_passthrough_attach(mock_mode, captured_run) -> None:
    async with _client() as client:
        response = await client.post("/api/v1/vms/303/passthrough/attach", json={"device_type": "both"})

    assert response.status_code == 202
    payload = response.json()
    assert (payload["action"], payload["vmid"], payload["device_type"]) == ("attach", 303, "both")
    assert captured_run["command"] == "forge"
    assert captured_run["args"] == ["passthrough", "attach", "--vmid", "303", "--device", "both"]
    assert not captured_run["env_overrides"]


@pytest.mark.asyncio
@pytest.mark.parametrize("action", ["attach", "detach"])
async def test_running_vm_is_rejected_without_force_stop(mock_mode, captured_run, action: str) -> None:
    async with _client() as client:
        response = await client.post(f"/api/v1/vms/302/passthrough/{action}", json={"device_type": "gpu"})

    assert response.status_code == 409
    assert "running" in response.json()["detail"]
    assert "force_stop" in response.json()["detail"]
    assert captured_run == {}


@pytest.mark.asyncio
@pytest.mark.parametrize("action", ["attach", "detach"])
async def test_running_vm_with_force_stop_passes_stop_flag(mock_mode, captured_run, action: str) -> None:
    async with _client() as client:
        response = await client.post(
            f"/api/v1/vms/302/passthrough/{action}", json={"device_type": "nic", "force_stop": True}
        )

    assert response.status_code == 202
    assert response.json()["force_stop"] is True
    assert captured_run["args"] == ["passthrough", action, "--vmid", "302", "--device", "nic", "--stop"]


@pytest.mark.asyncio
async def test_detach_stopped_vm_with_pci_bdf_sets_forge_env(mock_mode, captured_run) -> None:
    async with _client() as client:
        response = await client.post(
            "/api/v1/vms/301/passthrough/detach", json={"device_type": "gpu", "pci_bdf": "0000:05:00.0"}
        )

    assert response.status_code == 202
    assert captured_run["args"] == ["passthrough", "detach", "--vmid", "301", "--device", "gpu"]
    assert captured_run["env_overrides"] == {"GPU_PCIE_DEVICE": "0000:05:00.0"}


@pytest.mark.asyncio
async def test_attach_records_audit_event(mock_mode, captured_run) -> None:
    async with _client() as client:
        await client.post("/api/v1/vms/303/passthrough/attach", json={"device_type": "gpu"})
        await client.post("/api/v1/vms/301/passthrough/detach", json={"device_type": "gpu"})
        attached = (await client.get("/api/v1/audit/logs?verb=passthrough-attached")).json()["logs"]
        detached = (await client.get("/api/v1/audit/logs?verb=passthrough-detached")).json()["logs"]

    assert attached[0]["details"]["vmid"] == 303
    assert detached[0]["details"]["vmid"] == 301


@pytest.mark.asyncio
async def test_attach_validation_errors(mock_mode, captured_run) -> None:
    async with _client() as client:
        unknown_vm = await client.post("/api/v1/vms/999/passthrough/attach", json={})
        assigned = await client.post(
            "/api/v1/vms/303/passthrough/attach", json={"device_type": "gpu", "pci_bdf": "0000:05:00.0"}
        )
        wrong_class = await client.post(
            "/api/v1/vms/303/passthrough/attach", json={"device_type": "gpu", "pci_bdf": "0000:07:00.0"}
        )
        undiscovered = await client.post(
            "/api/v1/vms/303/passthrough/attach", json={"device_type": "gpu", "pci_bdf": "0000:99:00.0"}
        )
        both_with_bdf = await client.post(
            "/api/v1/vms/303/passthrough/attach", json={"device_type": "both", "pci_bdf": "0000:65:00.0"}
        )
        bad_bdf = await client.post(
            "/api/v1/vms/303/passthrough/attach", json={"device_type": "gpu", "pci_bdf": "not-a-bdf; rm -rf /"}
        )
        bad_device = await client.post("/api/v1/vms/303/passthrough/attach", json={"device_type": "tpu"})
        viewer = await client.post(
            "/api/v1/vms/303/passthrough/attach", json={}, headers={"X-Forge-Role": "viewer"}
        )

    assert unknown_vm.status_code == 404
    assert assigned.status_code == 409 and "gpu-wk-01" in assigned.json()["detail"]
    assert wrong_class.status_code == 400
    assert undiscovered.status_code == 404
    assert both_with_bdf.status_code == 400
    assert bad_bdf.status_code == 422
    assert bad_device.status_code == 422
    assert viewer.status_code == 403
    assert captured_run == {}


@pytest.mark.asyncio
async def test_attach_free_bdf_exports_gpu_env(mock_mode, captured_run) -> None:
    async with _client() as client:
        response = await client.post(
            "/api/v1/vms/303/passthrough/attach", json={"device_type": "gpu", "pci_bdf": "0000:65:00.0"}
        )

    assert response.status_code == 202
    assert captured_run["env_overrides"] == {"GPU_PCIE_DEVICE": "0000:65:00.0"}


@pytest.mark.asyncio
async def test_live_mode_power_state_comes_from_forge_vm_list(monkeypatch: pytest.MonkeyPatch, captured_run) -> None:
    monkeypatch.delenv("FORGE_MOCK_MODE", raising=False)
    get_settings.cache_clear()

    async def fake_capture(argv: list[str]):
        assert argv[1:] == ["vm-list", "--json"]
        return 0, '{"vms": [{"vmid": 320, "name": "gpu-wk-20", "status": "running"}]}', ""

    monkeypatch.setattr(passthrough_service, "_capture", fake_capture)
    async with _client() as client:
        refused = await client.post("/api/v1/vms/320/passthrough/attach", json={})
        allowed = await client.post("/api/v1/vms/320/passthrough/attach", json={"force_stop": True})
        missing = await client.post("/api/v1/vms/321/passthrough/attach", json={"force_stop": True})
    get_settings.cache_clear()

    assert refused.status_code == 409
    assert allowed.status_code == 202
    assert missing.status_code == 404


# ---------------------------------------------------------------------------
# POST /provision-gpu
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_provision_gpu_dispatches_forge_provision_gpu_vms_and_audits(mock_mode, captured_run) -> None:
    async with _client() as client:
        response = await client.post(
            "/api/v1/vms/provision-gpu",
            json={"cluster_name": "amd-nkp1", "gpu_worker_count": 2, "gpu_bdf": "0000:65:00.0", "nic_bdf": "0000:67:00.0"},
        )

    assert response.status_code == 202
    payload = response.json()
    assert payload["cluster_name"] == "amd-nkp1"
    assert payload["gpu_worker_count"] == 2
    assert payload["conf_path"].endswith("amd-nkp1/amd-nkp1-input.ini")
    assert captured_run["command"] == "forge"
    assert captured_run["args"][:3] == ["provision", "gpu-vms", "--conf"]
    assert captured_run["args"][3] == payload["conf_path"]
    assert captured_run["env_overrides"] == {
        "GPU_WORKER_COUNT": "2",
        "GPU_PCIE_DEVICE": "0000:65:00.0",
        "PENSANDO_NIC_PCIE_DEVICE": "0000:67:00.0",
    }
    async with _client() as client:
        logs = (await client.get("/api/v1/audit/logs?verb=gpu-vms-provisioned")).json()["logs"]
    assert logs[0]["run_id"] == payload["run_id"]
    assert logs[0]["details"]["cluster_name"] == "amd-nkp1"
    assert logs[0]["details"]["gpu_worker_count"] == 2


@pytest.mark.asyncio
async def test_provision_gpu_defaults_to_one_worker_without_bdf_env(mock_mode, captured_run) -> None:
    async with _client() as client:
        response = await client.post("/api/v1/vms/provision-gpu", json={"cluster_name": "amd-nkp1"})

    assert response.status_code == 202
    assert response.json()["gpu_worker_count"] == 1
    assert captured_run["env_overrides"] == {"GPU_WORKER_COUNT": "1"}


@pytest.mark.asyncio
async def test_provision_gpu_live_mode_requires_generated_cluster_config(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, captured_run
) -> None:
    monkeypatch.delenv("FORGE_MOCK_MODE", raising=False)
    monkeypatch.setenv("FORGE_STATE_DIR", str(tmp_path / "forge-state"))
    get_settings.cache_clear()
    async with _client() as client:
        missing = await client.post("/api/v1/vms/provision-gpu", json={"cluster_name": "amd-nkp1"})
        conf = tmp_path / "forge-state" / "amd-nkp1" / "amd-nkp1-input.ini"
        conf.parent.mkdir(parents=True)
        conf.write_text("[cluster]\n")
        found = await client.post("/api/v1/vms/provision-gpu", json={"cluster_name": "amd-nkp1"})
    get_settings.cache_clear()

    assert missing.status_code == 404
    assert "init-config" in missing.json()["detail"]
    assert found.status_code == 202
    assert captured_run["args"] == ["provision", "gpu-vms", "--conf", str(conf)]


@pytest.mark.asyncio
async def test_provision_gpu_validation_errors(mock_mode, captured_run) -> None:
    async with _client() as client:
        bad_name = await client.post("/api/v1/vms/provision-gpu", json={"cluster_name": "../etc"})
        zero = await client.post("/api/v1/vms/provision-gpu", json={"cluster_name": "c1", "gpu_worker_count": 0})
        bad_bdf = await client.post("/api/v1/vms/provision-gpu", json={"cluster_name": "c1", "gpu_bdf": "zzz"})
        taken = await client.post("/api/v1/vms/provision-gpu", json={"cluster_name": "c1", "gpu_bdf": "0000:25:00.0"})
        nic_as_gpu = await client.post("/api/v1/vms/provision-gpu", json={"cluster_name": "c1", "gpu_bdf": "0000:07:00.0"})
        viewer = await client.post(
            "/api/v1/vms/provision-gpu", json={"cluster_name": "c1"}, headers={"X-Forge-Role": "viewer"}
        )

    assert bad_name.status_code == 422
    assert zero.status_code == 422
    assert bad_bdf.status_code == 422
    assert taken.status_code == 409
    assert nic_as_gpu.status_code == 400
    assert viewer.status_code == 403
    assert captured_run == {}


@pytest.mark.asyncio
async def test_mock_mode_attach_runs_synthetic_log_without_spawning_forge(
    mock_mode, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fail_spawn(*_args, **_kwargs):
        raise AssertionError("./forge must not be spawned in mock mode")

    monkeypatch.setattr("asyncio.create_subprocess_exec", fail_spawn)
    async with _client() as client:
        response = await client.post("/api/v1/vms/303/passthrough/attach", json={"device_type": "gpu"})

    assert response.status_code == 202
