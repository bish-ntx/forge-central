from __future__ import annotations

import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import HTTPException

from ..config import get_settings
from ..schemas.lab import LabConfigRequest, LabConfigResponse, LabInitResponse, LAB_NAME_RE
from ..timeutil import iso_utc

_INI_LINE = re.compile(r'^\s*([A-Z][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$')
_UNESCAPE = re.compile(r'\\([\\"$`])')


def ini_assign(key: str, value: object) -> str:
    r"""Render `KEY="value"` like the CLI's `_forge_ini_assign` (backslash, quote, `$` and backtick escaped)."""
    escaped = re.sub(r'([\\"$`])', r"\\\1", "" if value is None else str(value))
    return f'{key}="{escaped}"'


def read_ini(path: Path) -> Dict[str, str]:
    """Parse a flat `KEY="value"` INI file; comments and malformed lines are skipped."""
    values: Dict[str, str] = {}
    for line in path.read_text().splitlines():
        match = _INI_LINE.match(line)
        if match and not line.lstrip().startswith("#"):
            values[match.group(1)] = _UNESCAPE.sub(r"\1", match.group(2))
    return values


def write_private_file(path: Path, lines: List[str]) -> None:
    """Write an INI file atomically with chmod 600 (it may hold credentials)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as handle:
        handle.write("\n".join(lines) + "\n")
    os.replace(tmp, path)
    path.chmod(0o600)


def labs_dir() -> Path:
    return get_settings().forge_home.expanduser() / "labs"


def lab_ini_path(lab_name: str) -> Path:
    return labs_dir() / lab_name / f"{lab_name}-infra.ini"


def discover_labs() -> List[str]:
    root = labs_dir()
    if not root.is_dir():
        return []
    return sorted(d.name for d in root.iterdir() if d.is_dir() and (d / f"{d.name}-infra.ini").is_file())


def get_lab_config(lab: Optional[str] = None) -> LabConfigResponse:
    """Parse the requested (or first discovered) lab's `<lab>-infra.ini`; defaults when none exists."""
    labs = discover_labs()
    if lab and not LAB_NAME_RE.match(lab):
        raise HTTPException(status_code=400, detail="invalid lab name")
    lab = lab or (labs[0] if labs else None)
    if not lab or lab not in labs:
        if lab:
            raise HTTPException(status_code=404, detail=f"lab not found: {lab}")
        return LabConfigResponse(labs=labs)
    path = lab_ini_path(lab)
    v = read_ini(path)
    return LabConfigResponse(
        configured=True,
        lab_name=v.get("LAB_NAME") or lab,
        config_path=str(path),
        labs=labs,
        pve_host=v.get("PVE_CLUSTER_HOST", ""),
        pve_node=v.get("PVE_TARGET_NODE", ""),
        pve_user=v.get("PVE_USER") or "root",
        has_password=bool(v.get("PVE_PASSWORD")),
        storage_pool=v.get("STORAGE_POOL", ""),
        resource_pool=v.get("RESOURCE_POOL") or None,
        network_bridge=v.get("NETWORK_BRIDGE") or "vmbr0",
        nameserver=v.get("NAMESERVER", ""),
        search_domain=v.get("SEARCH_DOMAIN") or None,
        lab_ip_pool=v.get("LAB_IP_POOL", ""),
        golden_vmid=int(v.get("GOLDEN_TEMPLATE_VMID") or 100),
        golden_name=v.get("GOLDEN_TEMPLATE_NAME") or "ubuntu-2404-golden",
        registry_type=v.get("REGISTRY_TYPE") or "dockerhub",
        storage_mode=v.get("STORAGE_MODE") or "local",
        nkp_version=v.get("NKP_CLI_VERSION", ""),
    )


def init_lab(payload: LabConfigRequest) -> LabInitResponse:
    """Write a validated `<lab>-infra.ini` (chmod 600), keeping the previous file as `.bak`.

    Keys mirror `forge init lab` output so the CLI can consume the file unchanged.
    """
    path = lab_ini_path(payload.lab_name)
    existing: Dict[str, str] = read_ini(path) if path.is_file() else {}
    password = payload.pve_password if payload.pve_password is not None else existing.get("PVE_PASSWORD", "")
    now = datetime.now(timezone.utc)
    fields = [
        ("PLATFORM", "proxmox"),
        ("LAB_NAME", payload.lab_name),
        ("PVE_CLUSTER_HOST", payload.pve_host),
        ("PVE_TARGET_NODE", payload.pve_node),
        ("PVE_USER", payload.pve_user),
        ("PVE_PASSWORD", password),
        ("GOLDEN_TEMPLATE_VMID", payload.golden_vmid),
        ("GOLDEN_TEMPLATE_NAME", payload.golden_name),
        ("RESOURCE_POOL", payload.resource_pool or ""),
        ("STORAGE_POOL", payload.storage_pool),
        ("NETWORK_BRIDGE", payload.network_bridge),
        ("NAMESERVER", payload.nameserver),
        ("SEARCH_DOMAIN", payload.search_domain or ""),
        ("LAB_IP_POOL", payload.lab_ip_pool),
        ("REGISTRY_TYPE", payload.registry_type),
        ("STORAGE_MODE", payload.storage_mode),
    ]
    if path.is_file():
        shutil.copy2(path, path.with_name(path.name + ".bak"))
    lines = [
        f"# Forge Central — Lab-Infra Config: {payload.lab_name}",
        f"# Written by Forge Central Day-0 wizard on {iso_utc(now)}. chmod 600.",
        *(ini_assign(key, value) for key, value in fields),
    ]
    write_private_file(path, lines)
    return LabInitResponse(lab_name=payload.lab_name, config_path=str(path), updated_at=now)
