from __future__ import annotations

from pathlib import Path
import sys

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.main import mount_ui_static


def _client(app: FastAPI) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_static_mount_serves_dist_and_keeps_api_routes_first(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<html>forge-ui</html>")
    app = FastAPI()

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    assert mount_ui_static(app, tmp_path) is True
    async with _client(app) as client:
        assert (await client.get("/health")).json() == {"status": "ok"}
        root = await client.get("/")
        assert root.status_code == 200
        assert "forge-ui" in root.text


def test_static_mount_skipped_when_dist_missing(tmp_path: Path) -> None:
    app = FastAPI()
    assert mount_ui_static(app, tmp_path / "missing") is False
    assert not any(route.path == "/" for route in app.routes)
