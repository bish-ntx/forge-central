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
