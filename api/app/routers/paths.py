from __future__ import annotations

import os
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from ..config import get_settings
from ..schemas.paths import (
    PathMigrationRequest,
    PathMigrationResponse,
    PathsInspectionResponse,
    PathStatusItem,
)
from .audit import record_audit_event
from .auth import require_mutating_role

router = APIRouter(prefix="/api/v1/settings/paths", tags=["settings"])

MIGRATABLE_SUFFIXES = {".ini", ".yaml", ".json", ".log"}


def _inspect_path(name: str, raw_path: Path) -> PathStatusItem:
    path = raw_path.expanduser()
    exists = path.exists()
    accessible = exists and os.access(path, os.R_OK | os.X_OK)
    writable = exists and os.access(path, os.W_OK)
    status = "missing" if not exists else ("accessible" if writable else "read-only")
    free_bytes = total_bytes = 0
    if exists:
        try:
            usage = shutil.disk_usage(path)
            free_bytes, total_bytes = usage.free, usage.total
        except OSError:
            pass
    return PathStatusItem(
        name=name,
        path=str(path),
        exists=exists,
        accessible=accessible,
        writable=writable,
        status=status,
        free_bytes=free_bytes,
        total_bytes=total_bytes,
    )


@router.get("", response_model=PathsInspectionResponse)
async def inspect_paths() -> PathsInspectionResponse:
    """Inspect configured Forge system directories for existence, permissions and disk usage."""
    settings = get_settings()
    return PathsInspectionResponse(
        paths=[
            _inspect_path("FORGE_HOME", settings.forge_home),
            _inspect_path("FORGE_DATA_DIR", settings.forge_data_dir),
            _inspect_path("FORGE_CENTRAL_DATA_DIR", settings.forge_central_data_dir),
            _inspect_path("FORGE_BACKUP_DIR", settings.forge_backup_dir),
            _inspect_path("FORGE_LOG_DIR", settings.forge_log_dir),
        ]
    )


@router.post("/migrate", response_model=PathMigrationResponse, dependencies=[Depends(require_mutating_role)])
async def migrate_state_directory(payload: PathMigrationRequest) -> PathMigrationResponse:
    """Copy state files (*.ini, *.yaml, *.json, *.log) from a source to a target directory; supports dry-run."""
    source = Path(payload.source_dir).expanduser()
    target = Path(payload.target_dir).expanduser()
    if not source.is_dir():
        raise HTTPException(status_code=400, detail=f"source directory not found: {payload.source_dir}")
    if source.resolve() == target.resolve():
        raise HTTPException(status_code=400, detail="source and target directories must differ")

    files = sorted(f for f in source.rglob("*") if f.is_file() and f.suffix.lower() in MIGRATABLE_SUFFIXES)
    relative_names = [str(f.relative_to(source)) for f in files]
    bytes_total = sum(f.stat().st_size for f in files)

    if not payload.dry_run:
        target.mkdir(parents=True, exist_ok=True)
        for f, rel in zip(files, relative_names):
            destination = target / rel
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, destination)

    record_audit_event(
        run_id=f"migration-{uuid4().hex[:8]}",
        verb="paths-migrated",
        user="system-admin",
        status="succeeded",
        duration_sec=1.2,
        details={"source": payload.source_dir, "target": payload.target_dir, "dry_run": payload.dry_run},
    )
    action = "Would migrate" if payload.dry_run else "Migrated"
    return PathMigrationResponse(
        success=True,
        dry_run=payload.dry_run,
        source_dir=str(source),
        target_dir=str(target),
        files_scanned=len(files),
        files_migrated=0 if payload.dry_run else len(files),
        bytes_migrated=0 if payload.dry_run else bytes_total,
        migrated_files=relative_names,
        message=f"{action} {len(files)} file(s) ({bytes_total} bytes) from {source} to {target}",
    )
