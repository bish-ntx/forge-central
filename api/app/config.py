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
    forge_data_dir: Path = Path("~/forge-data")

    @property
    def forge_bin_resolved(self) -> Path:
        return self.forge_bin.expanduser().resolve()

    @property
    def forge_data_dir_resolved(self) -> Path:
        return self.forge_data_dir.expanduser().resolve()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    forge_bin = os.getenv("FORGE_BIN")
    forge_data_dir = os.getenv("FORGE_DATA_DIR")
    return Settings(
        forge_bin=Path(forge_bin).expanduser() if forge_bin else Path.cwd() / "forge",
        forge_data_dir=Path(forge_data_dir).expanduser() if forge_data_dir else Path("~/forge-data"),
    )
