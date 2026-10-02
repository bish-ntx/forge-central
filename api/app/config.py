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
    forge_cacrt_dir: Path = Path("~/cacrt")  # staged registry credentials + Harbor CA certs
    forge_state_dir: Path = Path("~/forge-state")  # <cluster>/<cluster>-input.ini cluster configs
    forge_central_ip: str = ""  # address bastions mount product shares from (auto-detected when blank)
    forge_bastion_user: str = "nkpadmin"  # SSH user on cluster bastions
    forge_bastion_forge_path: str = "nkp-forge/forge"  # forge CLI path on the bastion, relative to its $HOME
    forge_bastion_state_dir: str = "forge-state"  # forge-state dir on the bastion, relative to its $HOME
    forge_mock_mode: bool = False
    forge_display_timezone: str = "America/Los_Angeles"  # local label for log headers only
    forge_admin_password: str = "Nutanix.123"  # passphrase that unlocks the admin role
    forge_otel_enabled: bool = False  # lightweight OTel exporter flag (no SDK dependency)
    forge_otel_collector_url: str = "http://localhost:4318"  # OTLP/HTTP collector endpoint

    @property
    def forge_bin_resolved(self) -> Path:
        return self.forge_bin.expanduser().resolve()

    @property
    def forge_state_dir_resolved(self) -> Path:
        return self.forge_state_dir.expanduser().resolve()

    @property
    def forge_data_dir_resolved(self) -> Path:
        return self.forge_data_dir.expanduser().resolve()

    @property
    def forge_central_data_dir_resolved(self) -> Path:
        return self.forge_central_data_dir.expanduser().resolve()


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
            ("forge_cacrt_dir", "FORGE_CACRT_DIR"),
            ("forge_state_dir", "FORGE_STATE_DIR"),
        )
        for value in [os.getenv(env)]
        if value
    }
    return Settings(
        forge_display_timezone=os.getenv("FORGE_DISPLAY_TZ", "").strip() or "America/Los_Angeles",
        forge_mock_mode=os.getenv("FORGE_MOCK_MODE", "").strip().lower() in {"1", "true", "yes", "on"},
        forge_central_ip=os.getenv("FORGE_CENTRAL_IP", "").strip(),
        forge_bastion_user=os.getenv("FORGE_BASTION_USER", "").strip() or "nkpadmin",
        forge_bastion_forge_path=os.getenv("FORGE_BASTION_FORGE_PATH", "").strip() or "nkp-forge/forge",
        forge_bastion_state_dir=os.getenv("FORGE_BASTION_STATE_DIR", "").strip() or "forge-state",
        forge_admin_password=os.getenv("FORGE_ADMIN_PASSWORD") or "Nutanix.123",
        forge_otel_enabled=os.getenv("FORGE_OTEL_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"},
        forge_otel_collector_url=os.getenv("FORGE_OTEL_COLLECTOR_URL", "").strip() or "http://localhost:4318",
        forge_bin=Path(forge_bin).expanduser() if forge_bin else Path.cwd() / "forge",
        **overrides,
    )
