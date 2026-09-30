from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class PathStatusItem(BaseModel):
    name: str
    path: str
    exists: bool
    accessible: bool
    writable: bool
    status: str
    free_bytes: int = 0
    total_bytes: int = 0


class PathsInspectionResponse(BaseModel):
    paths: List[PathStatusItem]


class PathMigrationRequest(BaseModel):
    source_dir: str
    target_dir: str
    dry_run: bool = False


class PathMigrationResponse(BaseModel):
    success: bool
    dry_run: bool
    source_dir: str
    target_dir: str
    files_scanned: int = 0
    files_migrated: int = 0
    bytes_migrated: int = 0
    migrated_files: List[str] = Field(default_factory=list)
    message: str
