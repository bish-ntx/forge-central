from __future__ import annotations

import os
import socket
import subprocess
import time
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
    process = subprocess.Popen(  # noqa: S603
        command,
        cwd=REPO_ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        _wait_for_url(f"{backend_url}/health")
        yield backend_url
    finally:
        process.terminate()
        process.wait(timeout=15)


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
