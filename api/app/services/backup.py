from __future__ import annotations

import hashlib
import tarfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from ..config import get_settings
from ..routers.audit import record_audit_event
from ..schemas.backup import BackupCreateResponse, BackupItem

ARCHIVE_SUFFIX = ".tar.gz"
DB_FILENAME = "forge-central.db"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _sources() -> list[tuple[Path, str]]:
    data_dir = get_settings().forge_central_data_dir.expanduser()
    if not data_dir.is_dir():
        data_dir = Path.home() / "forge-state"
    candidates = [
        (data_dir, "state"),
        (Path.home() / "cacrt", "cacrt"),
        (data_dir / DB_FILENAME, DB_FILENAME),
        (Path.cwd() / DB_FILENAME, DB_FILENAME),
    ]
    seen: set[str] = set()
    sources = []
    for path, arcname in candidates:
        if path.exists() and arcname not in seen:
            seen.add(arcname)
            sources.append((path, arcname))
    return sources


def _item(path: Path, checksum: str) -> BackupItem:
    stat = path.stat()
    return BackupItem(
        backup_id=path.name.removesuffix(ARCHIVE_SUFFIX),
        filename=path.name,
        file_size_bytes=stat.st_size,
        created_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
        checksum_sha256=checksum,
    )


def create_backup(target_dir: Optional[Path] = None) -> BackupCreateResponse:
    """Bundle state, CA certs and the SQLite DB into a checksummed `.tar.gz` (excluding `*.log`)."""
    directory = (target_dir or get_settings().forge_backup_dir).expanduser().resolve()
    directory.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"forge-central-backup-{timestamp}-{uuid4().hex[:8]}{ARCHIVE_SUFFIX}"
    archive = directory / filename

    def _exclude(info: tarfile.TarInfo) -> Optional[tarfile.TarInfo]:
        return None if info.name.endswith(".log") else info

    with tarfile.open(archive, "w:gz") as tar:
        for path, arcname in _sources():
            # Never nest the backup directory (or its archives) inside a new archive.
            if path.resolve() == directory or directory in path.resolve().parents:
                continue
            tar.add(path, arcname=arcname, filter=_exclude)

    checksum = _sha256(archive)
    archive.with_name(filename + ".sha256").write_text(f"{checksum}  {filename}\n")
    item = _item(archive, checksum)
    record_audit_event(
        run_id=f"backup-{item.backup_id[-8:]}",
        verb="backup-created",
        user="system-admin",
        status="succeeded",
        duration_sec=0.0,
        details={"filename": filename, "checksum": checksum, "size": item.file_size_bytes},
    )
    return BackupCreateResponse(**item.model_dump())


def list_backups() -> list[BackupItem]:
    """Return existing backup archives in `forge_backup_dir`, newest first."""
    directory = get_settings().forge_backup_dir.expanduser()
    if not directory.is_dir():
        return []
    items = []
    for path in directory.glob(f"*{ARCHIVE_SUFFIX}"):
        companion = path.with_name(path.name + ".sha256")
        tokens = companion.read_text().split() if companion.is_file() else []
        items.append(_item(path, tokens[0] if tokens else _sha256(path)))
    return sorted(items, key=lambda item: item.created_at, reverse=True)
