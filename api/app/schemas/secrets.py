from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from ..timeutil import UtcDatetime
from .lab import LAB_NAME_RE


class SecretSaveRequest(BaseModel):
    sec_type: Literal["dockerhub", "harbor"]
    user: str = Field(min_length=1)
    password: str = Field(min_length=1)
    url: Optional[str] = None
    ca_path: Optional[str] = None
    cluster: Optional[str] = None  # required for harbor

    @field_validator("cluster")
    @classmethod
    def _cluster(cls, value: Optional[str]) -> Optional[str]:
        if value and not LAB_NAME_RE.match(value):
            raise ValueError("cluster must be alphanumeric with '-' or '_'")
        return value

    @model_validator(mode="after")
    def _harbor_needs_cluster(self) -> "SecretSaveRequest":
        if self.sec_type == "harbor" and not self.cluster:
            raise ValueError("cluster is required for harbor secrets")
        return self


class SecretItem(BaseModel):
    sec_type: str
    user: str
    path: str
    cluster: Optional[str] = None
    has_ca: bool = False
    password_masked: str = "********"
    updated_at: UtcDatetime


class SecretListResponse(BaseModel):
    secrets: List[SecretItem] = Field(default_factory=list)


class SecretDeleteResponse(BaseModel):
    status: str = "deleted"
    sec_type: str
    cluster: Optional[str] = None
