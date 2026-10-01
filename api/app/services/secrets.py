from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException

from ..config import get_settings
from ..schemas.lab import LAB_NAME_RE
from ..schemas.secrets import SecretItem, SecretSaveRequest
from .lab import ini_assign, read_ini, write_private_file

DOCKERHUB_DEFAULT_URL = "https://index.docker.io/v1/"


def _root() -> Path:
    return get_settings().forge_cacrt_dir.expanduser()


def secret_path(sec_type: str, cluster: Optional[str] = None) -> Path:
    """Canonical CLI locations: `dockerhub/dockerhub-creds.ini` and `<cluster>/harbor-creds.ini`."""
    if sec_type == "dockerhub":
        return _root() / "dockerhub" / "dockerhub-creds.ini"
    if sec_type != "harbor":
        raise HTTPException(status_code=400, detail="sec_type must be dockerhub or harbor")
    if not cluster or not LAB_NAME_RE.match(cluster):
        raise HTTPException(status_code=400, detail="harbor secrets require a valid cluster name")
    return _root() / cluster / "harbor-creds.ini"


def _item(sec_type: str, path: Path, cluster: Optional[str]) -> SecretItem:
    values = read_ini(path)
    prefix = sec_type.upper()
    ca_path = values.get("HARBOR_CA_PATH", "")
    return SecretItem(
        sec_type=sec_type,
        user=values.get(f"{prefix}_USERNAME", ""),
        path=str(path),
        cluster=cluster,
        has_ca=bool(ca_path) and Path(ca_path).expanduser().is_file(),
        updated_at=datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc),
    )


def list_secrets() -> List[SecretItem]:
    """List staged credential files; passwords are never read into the response."""
    items: List[SecretItem] = []
    dockerhub = secret_path("dockerhub")
    if dockerhub.is_file():
        items.append(_item("dockerhub", dockerhub, None))
    root = _root()
    if root.is_dir():
        for harbor in sorted(root.glob("*/harbor-creds.ini")):
            items.append(_item("harbor", harbor, harbor.parent.name))
    return items


def save_secret(payload: SecretSaveRequest) -> SecretItem:
    """Stage credentials as a chmod 600 INI using the same keys as `forge secret save`."""
    path = secret_path(payload.sec_type, payload.cluster)
    if payload.sec_type == "dockerhub":
        lines = [
            "# Forge Central — Docker Hub credentials (Day-0 bootstrap pulls). chmod 600.",
            ini_assign("DOCKERHUB_USERNAME", payload.user),
            ini_assign("DOCKERHUB_PASSWORD", payload.password),
            ini_assign("DOCKERHUB_URL", payload.url or DOCKERHUB_DEFAULT_URL),
        ]
    else:
        lines = [
            f"# Forge Central — Harbor credentials for cluster {payload.cluster}. chmod 600.",
            ini_assign("HARBOR_CLUSTER_NAME", payload.cluster),
            ini_assign("HARBOR_USERNAME", payload.user),
            ini_assign("HARBOR_PASSWORD", payload.password),
            ini_assign("HARBOR_URL", payload.url or "https://harbor.local:5000/library"),
            ini_assign("HARBOR_CA_PATH", payload.ca_path or str(_root() / payload.cluster / "ca.crt")),
        ]
    write_private_file(path, lines)
    return _item(payload.sec_type, path, payload.cluster)


def delete_secret(sec_type: str, cluster: Optional[str] = None) -> None:
    path = secret_path(sec_type, cluster)
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"no staged {sec_type} secret")
    path.unlink()
