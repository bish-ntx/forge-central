from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class DiagnosticsCaptureRequest(BaseModel):
    cluster_name: str
    include_logs: bool = True
    node_names: Optional[List[str]] = None


class DiagnosticsCaptureResponse(BaseModel):
    bundle_id: str
    cluster_name: str
    filename: str
    file_size_bytes: int
    status: str
    captured_at: str
    download_url: str


class SupportBundleInfo(BaseModel):
    bundle_id: str
    cluster_name: str
    filename: str
    file_size_bytes: int
    captured_at: str
    status: str


class SupportBundleListResponse(BaseModel):
    bundles: List[SupportBundleInfo] = Field(default_factory=list)
