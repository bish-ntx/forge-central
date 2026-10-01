from __future__ import annotations

import hashlib
import platform
import re
import shutil
from pathlib import Path

from fastapi import APIRouter

from ..config import get_settings
from ..schemas.upgrade import (
    UpgradeInspectRequest,
    UpgradeInspectResponse,
    UpgradeStatusResponse,
    ValidationCheck,
)

router = APIRouter(tags=["upgrade"])

MIN_FREE_BYTES = 1024**3
VERSION_PATTERN = re.compile(r"forge-central-v(\d+(?:\.\d+)*)\.tar\.gz$")


def _version_tuple(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in version.split("."))


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@router.get("/upgrade/status", response_model=UpgradeStatusResponse)
async def get_upgrade_status() -> UpgradeStatusResponse:
    """Return the running Forge Central version and host architecture/platform."""
    return UpgradeStatusResponse(
        current_version=get_settings().control_plane_version,
        arch=platform.machine(),
        platform=platform.system(),
    )


@router.post("/upgrade/inspect", response_model=UpgradeInspectResponse)
async def inspect_upgrade_bundle(payload: UpgradeInspectRequest) -> UpgradeInspectResponse:
    """Run air-gapped pre-flight checks (format, checksum, version, disk space) on a release bundle."""
    current_version = get_settings().control_plane_version
    bundle = Path(payload.bundle_path).expanduser()
    match = VERSION_PATTERN.search(bundle.name)
    bundle_version = match.group(1) if match else "unknown"
    exists = bundle.is_file()
    checks: list[ValidationCheck] = []

    format_ok = bundle.name.endswith(".tar.gz") and exists
    checks.append(
        ValidationCheck(
            name="Bundle format",
            passed=format_ok,
            message=f"Found {bundle.name}" if format_ok else "Bundle must be an existing .tar.gz file",
        )
    )

    checksum_file = bundle.with_name(bundle.name + ".sha256")
    if not exists:
        checksum_ok, checksum_msg = False, "Bundle file not found; cannot verify checksum"
    elif checksum_file.is_file():
        tokens = checksum_file.read_text().split()
        expected = tokens[0].lower() if tokens else ""
        actual = _sha256(bundle)
        checksum_ok = expected == actual
        checksum_msg = "SHA-256 matches companion .sha256 file" if checksum_ok else "SHA-256 does not match companion .sha256 file"
    else:
        checksum_ok, checksum_msg = False, f"Companion checksum file missing: {checksum_file.name}"
    checks.append(ValidationCheck(name="Checksum", passed=checksum_ok, message=checksum_msg))

    if match:
        version_ok = _version_tuple(bundle_version) >= _version_tuple(current_version)
        version_msg = (
            f"Bundle {bundle_version} is compatible with current {current_version}"
            if version_ok
            else f"Bundle {bundle_version} is older than current {current_version}"
        )
    else:
        version_ok, version_msg = False, "Cannot extract version from filename (expected forge-central-v<VERSION>.tar.gz)"
    checks.append(ValidationCheck(name="Version compatibility", passed=version_ok, message=version_msg))

    free_bytes = shutil.disk_usage(bundle.parent if bundle.parent.exists() else Path.cwd()).free
    disk_ok = free_bytes > MIN_FREE_BYTES
    checks.append(
        ValidationCheck(
            name="Disk space",
            passed=disk_ok,
            message=f"{free_bytes / 1024**3:.1f} GB free" + ("" if disk_ok else " (need more than 1 GB)"),
        )
    )

    return UpgradeInspectResponse(
        valid=all(check.passed for check in checks),
        current_version=current_version,
        bundle_version=bundle_version,
        checks=checks,
    )
