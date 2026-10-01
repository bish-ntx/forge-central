from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class UnlockAdminRequest(BaseModel):
    passphrase: str = Field(min_length=1)


class UnlockAdminResponse(BaseModel):
    status: Literal["authorized"] = "authorized"
    role: Literal["admin"] = "admin"
