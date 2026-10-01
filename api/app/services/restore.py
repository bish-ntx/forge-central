from __future__ import annotations

import os
import shutil
import tarfile
from pathlib import Path, PurePosixPath
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from ..config import get_settings
from ..routers.audit import record_audit_event
from ..schemas.restore import RestoreExecuteResponse, RestoreVerifyCheck, RestoreVerifyResponse
from .backup import ARCHIVE_SUFFIX, DB_FILENAME, _sha256, create_backup


def _archive_path(backup_id: str) -> Path:
    name = backup_id if backup_id.endswith(ARCHIVE_SUFFIX) else backup_id + ARCHIVE_SUFFIX
    return get_settings().forge_backup_dir.expanduser() / Path(name).name  # basename only: no traversal


def verify_backup(backup_id: str) -> RestoreVerifyResponse:
    """Verify an archive exists, matches its stored SHA-256 and is a readable tarball."""
    archive = _archive_path(backup_id)
    checks: list[RestoreVerifyCheck] = []
    manifest: dict = {}

    exists = archive.is_file() and archive.name.endswith(ARCHIVE_SUFFIX)
    checks.append(RestoreVerifyCheck(
        name="archive-exists", passed=exists,
        message="Archive found" if exists else f"Archive not found: {archive.name}",
    ))
    if exists:
        companion = archive.with_name(archive.name + ".sha256")
        tokens = companion.read_text().split() if companion.is_file() else []
        actual = _sha256(archive)
        matched = bool(tokens) and tokens[0] == actual
        message = "SHA-256 matches" if matched else (
            "SHA-256 mismatch: archive was modified" if tokens else "Companion .sha256 file missing"
        )
        checks.append(RestoreVerifyCheck(name="checksum-match", passed=matched, message=message))
        try:
            with tarfile.open(archive, "r:gz") as tar:
                members = tar.getmembers()
            manifest = {
                "checksum_sha256": actual,
                "file_count": sum(1 for m in members if m.isfile()),
                "total_bytes": sum(m.size for m in members if m.isfile()),
                "entries": sorted({PurePosixPath(m.name).parts[0] for m in members if PurePosixPath(m.name).parts}),
            }
            checks.append(RestoreVerifyCheck(
                name="archive-integrity", passed=True, message=f"Archive readable ({manifest['file_count']} files)",
            ))
        except (tarfile.TarError, OSError, EOFError) as exc:
            checks.append(RestoreVerifyCheck(name="archive-integrity", passed=False, message=f"Corrupt archive: {exc}"))

    return RestoreVerifyResponse(
        valid=all(check.passed for check in checks),
        backup_id=archive.name.removesuffix(ARCHIVE_SUFFIX),
        filename=archive.name,
        manifest=manifest,
        checks=checks,
    )


def _destination(name: str, data_dir: Path) -> Optional[Path]:
    """Map an archive member to its restore location; None for unsafe or unknown entries."""
    parts = PurePosixPath(name).parts
    if not parts or PurePosixPath(name).is_absolute() or ".." in parts:
        return None
    root, rest = parts[0], parts[1:]
    if root == "state":
        return data_dir.joinpath(*rest)
    if root == DB_FILENAME and not rest:
        return data_dir / DB_FILENAME
    if root == "cacrt":
        return Path.home().joinpath("cacrt", *rest)
    return None


def execute_restore(backup_id: str) -> RestoreExecuteResponse:
    """Verify, take a safety snapshot, then restore state, CA certs and DB from the archive."""
    verification = verify_backup(backup_id)
    if not verification.valid:
        failed = "; ".join(c.message for c in verification.checks if not c.passed)
        raise HTTPException(status_code=400, detail=f"Backup verification failed: {failed}")

    safety = create_backup()
    data_dir = get_settings().forge_central_data_dir.expanduser()
    data_dir.mkdir(parents=True, exist_ok=True)
    restored = 0
    with tarfile.open(_archive_path(backup_id), "r:gz") as tar:
        for member in tar.getmembers():
            target = _destination(member.name, data_dir)
            if target is None or not (member.isfile() or member.isdir()):
                continue  # skip traversal attempts, symlinks and device nodes
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            staged = target.with_name(target.name + ".restore-tmp")
            with tar.extractfile(member) as source, staged.open("wb") as out:
                shutil.copyfileobj(source, out)
            os.replace(staged, target)  # atomic per-file swap
            restored += 1

    restore_id = f"restore-{uuid4().hex[:8]}"
    record_audit_event(
        run_id=restore_id,
        verb="state-restored",
        user="system-admin",
        status="succeeded",
        duration_sec=0.0,
        details={
            "backup_id": verification.backup_id,
            "safety_backup_id": safety.backup_id,
            "restored_files": restored,
        },
    )
    return RestoreExecuteResponse(
        restore_id=restore_id, restored_files_count=restored, safety_backup_id=safety.backup_id,
    )
