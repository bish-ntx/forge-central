from __future__ import annotations

from pathlib import Path
import sys

import pytest

sys.path.append(str(Path(__file__).resolve().parents[2]))

from api.app.config import get_settings


@pytest.fixture(autouse=True)
def isolated_backup_dir(tmp_path, monkeypatch):
    """Keep pre-mutation safety snapshots out of the real backup directory."""
    data = tmp_path / "central-data"
    data.mkdir()
    monkeypatch.setenv("FORGE_CENTRAL_DATA_DIR", str(data))
    monkeypatch.setenv("FORGE_BACKUP_DIR", str(tmp_path / "safety-backups"))
    get_settings.cache_clear()
    yield tmp_path / "safety-backups"
    get_settings.cache_clear()
