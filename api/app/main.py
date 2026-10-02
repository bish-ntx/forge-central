# =============================================================================
# Forge Central — FastAPI Entry Point
# Project: Forge Central Control Plane
# Version: 1.0.0
# Author:  Bishwajit Kumar <Bishwajit.Kumar@nutanix.com>
# Description: FastAPI app bootstrap and router registration.
# =============================================================================

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .routers.auth import router as auth_router
from .routers.backup import router as backup_router
from .routers.cli import router as cli_router
from .routers.clusters import router as clusters_router
from .routers.audit import router as audit_router
from .routers.diagnostics import router as diagnostics_router
from .routers.fleet import router as fleet_router
from .routers.inventory import router as inventory_router
from .routers.ipam import router as ipam_router
from .routers.lab import router as lab_router
from .routers.nodes import router as nodes_router
from .routers.paths import router as paths_router
from .routers.pipeline import router as pipeline_router
from .routers.restore import router as restore_router
from .routers.secrets import router as secrets_router
from .routers.telemetry import router as telemetry_router
from .routers.upgrade import router as upgrade_router
from .routers.vms import router as vms_router
from .services.log_publisher import LogPublisher
from .services.process_runner import ProcessRunner

settings = get_settings()
app = FastAPI(title=settings.app_name, version=settings.control_plane_version)
app.state.log_publisher = LogPublisher()
app.state.process_runner = ProcessRunner(
    forge_bin=settings.forge_bin_resolved,
    log_publisher=app.state.log_publisher,
)
app.include_router(auth_router)
app.include_router(cli_router)
app.include_router(pipeline_router)
app.include_router(vms_router)
app.include_router(clusters_router)
app.include_router(diagnostics_router)
app.include_router(audit_router)
app.include_router(inventory_router)
app.include_router(fleet_router)
app.include_router(paths_router)
app.include_router(nodes_router, prefix="/api/v1")
app.include_router(upgrade_router, prefix="/api/v1")
app.include_router(backup_router, prefix="/api/v1")
app.include_router(restore_router, prefix="/api/v1")
app.include_router(lab_router)
app.include_router(secrets_router)
app.include_router(ipam_router)
app.include_router(telemetry_router)


def mount_ui_static(application: FastAPI, ui_dist_path: Path | None = None) -> bool:
    """Serve the compiled UI from `ui/dist` (or `/app/ui/dist` in the container) as a static fallback.

    Mounted last so API routers always match first.
    """
    if ui_dist_path is None:
        ui_dist_path = Path(__file__).resolve().parents[2] / "ui" / "dist"
        if not ui_dist_path.exists():
            ui_dist_path = Path("/app/ui/dist")
    if not ui_dist_path.exists():
        return False
    application.mount("/", StaticFiles(directory=str(ui_dist_path), html=True), name="static")
    return True


mount_ui_static(app)
