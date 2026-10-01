"""UTC time discipline: all stored/emitted timestamps are ISO 8601 UTC (YYYY-MM-DDTHH:MM:SSZ)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator, PlainSerializer

from .config import get_settings


def to_utc(value: datetime) -> datetime:
    """Normalize to timezone-aware UTC (naive values are assumed to already be UTC)."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def iso_utc(value: datetime | None = None) -> str:
    """Format a datetime as ``YYYY-MM-DDTHH:MM:SSZ`` (defaults to now)."""
    return to_utc(value or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ")


# Pydantic v2 field type: tz-aware UTC datetime that serializes to JSON as ``...Z``.
UtcDatetime = Annotated[
    datetime,
    AfterValidator(to_utc),
    PlainSerializer(iso_utc, return_type=str, when_used="json"),
]


def dual_timestamp_header(value: datetime | None = None) -> str:
    """Return ``[TIMESTAMP] UTC: <iso>Z | Local (PST): YYYY-MM-DD HH:MM:SS PDT``."""
    utc = to_utc(value or datetime.now(timezone.utc))
    zone_name = get_settings().forge_display_timezone
    try:
        local = utc.astimezone(ZoneInfo(zone_name))
    except ZoneInfoNotFoundError:
        local = utc
    label = "PST" if zone_name == "America/Los_Angeles" else (local.tzname() or "UTC")
    return f"[TIMESTAMP] UTC: {iso_utc(utc)} | Local ({label}): {local.strftime('%Y-%m-%d %H:%M:%S %Z')}"
