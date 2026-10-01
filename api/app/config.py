# =============================================================================
# Forge Central — Configuration
# Project: Forge Central Control Plane
# Version: 1.0.0
# Author:  Bishwajit Kumar <Bishwajit.Kumar@nutanix.com>
# Description: Environment-driven runtime settings for API services.
# =============================================================================

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "Forge Central API"
    control_plane_version: str = "1.0.0"
    forge_bin: Path = Path.cwd() / "forge"
    forge_home: Path = Path("~/forge")
    forge_data_dir: Path = Path("~/forge-data")
    forge_central_data_dir: Path = Path("~/forge-central-data")
    forge_backup_dir: Path = Path("~/forge-backups")
    forge_log_dir: Path = Path("~/forge-logs")
    forge_mock_mode: bool = False

    @property
    def forge_bin_resolved(self) -> Path:
        return self.forge_bin.expanduser().resolve()

    @property
    def forge_data_dir_resolved(self) -> Path:
        return self.forge_data_dir.expanduser().resolve()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    forge_bin = os.getenv("FORGE_BIN")
    overrides = {
        field: Path(value).expanduser()
        for field, env in (
            ("forge_home", "FORGE_HOME"),
            ("forge_data_dir", "FORGE_DATA_DIR"),
            ("forge_central_data_dir", "FORGE_CENTRAL_DATA_DIR"),
            ("forge_backup_dir", "FORGE_BACKUP_DIR"),
            ("forge_log_dir", "FORGE_LOG_DIR"),
        )
        for value in [os.getenv(env)]
        if value
    }
    return Settings(
        forge_mock_mode=os.getenv("FORGE_MOCK_MODE", "").strip().lower() in {"1", "true", "yes", "on"},
        forge_bin=Path(forge_bin).expanduser() if forge_bin else Path.cwd() / "forge",
        **overrides,
    )
