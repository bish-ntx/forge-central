from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.request import Request
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]


def _find_open_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_url(url: str, timeout_seconds: float = 45.0) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=1.5) as response:
                if response.status < 500:
                    return
        except (URLError, TimeoutError):
            time.sleep(0.2)
    raise RuntimeError(f"timed out waiting for URL: {url}")


@pytest.fixture(scope="session")
def backend_base_url() -> str:
    backend_port = _find_open_port()
    backend_url = f"http://127.0.0.1:{backend_port}"
    command = [
        "python3",
        "-m",
        "uvicorn",
        "api.app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(backend_port),
    ]
    # Isolated lab/state directories + mock mode: the deploy wizard writes cluster configs and
    # reads IPAM slots, which must never touch the developer's real ~/forge or ~/forge-state.
    sandbox = tempfile.mkdtemp(prefix="forge-central-e2e-")
    env = os.environ.copy()
    env.update(
        {
            "FORGE_MOCK_MODE": "true",
            "FORGE_HOME": str(Path(sandbox) / "forge"),
            "FORGE_STATE_DIR": str(Path(sandbox) / "forge-state"),
            "FORGE_CENTRAL_DATA_DIR": str(Path(sandbox) / "central-data"),
            "FORGE_BACKUP_DIR": str(Path(sandbox) / "backups"),
        }
    )
    process = subprocess.Popen(  # noqa: S603
        command,
        cwd=REPO_ROOT,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        _wait_for_url(f"{backend_url}/health")
        yield backend_url
    finally:
        process.terminate()
        process.wait(timeout=15)
        shutil.rmtree(sandbox, ignore_errors=True)


@pytest.fixture(scope="session")
def e2e_lab(backend_base_url: str) -> str:
    """Create the lab the deploy wizard inherits from (POST /api/v1/lab/init, admin)."""
    payload = {
        "lab_name": "e2e-lab",
        "pve_host": "10.0.0.5",
        "pve_node": "pve1",
        "storage_pool": "local-lvm",
        "nameserver": "10.0.0.1",
        "lab_ip_pool": "10.0.0.10-10.0.0.40",
    }
    request = Request(  # noqa: S310
        f"{backend_base_url}/api/v1/lab/init",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "X-Forge-Role": "admin"},
        method="POST",
    )
    with urlopen(request, timeout=10) as response:  # noqa: S310
        assert response.status == 200
    return "e2e-lab"


@pytest.fixture(scope="session")
def base_url(backend_base_url: str) -> str:
    frontend_port = _find_open_port()
    frontend_url = f"http://127.0.0.1:{frontend_port}"
    env = os.environ.copy()
    env["VITE_BACKEND_PROXY_TARGET"] = backend_base_url
    env["VITE_TERMINAL_STREAM_URL"] = "/api/v1/test/live-terminal-stream"
    command = [
        "npm",
        "run",
        "dev",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        str(frontend_port),
        "--strictPort",
    ]
    process = subprocess.Popen(  # noqa: S603
        command,
        cwd=REPO_ROOT / "ui",
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        _wait_for_url(frontend_url)
        yield frontend_url
    finally:
        process.terminate()
        process.wait(timeout=15)
