# =============================================================================
# Forge Central — FastAPI Entry Point
# Project: Forge Central Control Plane
# Version: 1.0.0
# Author:  Bishwajit Kumar <Bishwajit.Kumar@nutanix.com>
# Description: FastAPI app bootstrap and router registration.
# =============================================================================

from __future__ import annotations

from fastapi import FastAPI

from .config import get_settings
from .routers.cli import router as cli_router
from .routers.clusters import router as clusters_router
from .routers.audit import router as audit_router
from .routers.diagnostics import router as diagnostics_router
from .routers.fleet import router as fleet_router
from .routers.inventory import router as inventory_router
from .routers.paths import router as paths_router
from .routers.pipeline import router as pipeline_router
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
app.include_router(cli_router)
app.include_router(pipeline_router)
app.include_router(vms_router)
app.include_router(clusters_router)
app.include_router(diagnostics_router)
app.include_router(audit_router)
app.include_router(inventory_router)
app.include_router(fleet_router)
app.include_router(paths_router)
