from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

ScannerState = Literal["idle", "scanning", "rate_limited", "error"]
TargetTab = Literal["unshielded", "expiring"]
SortOption = Literal["hq_desc", "hq_asc", "expires_asc", "name_asc"]


class HealthResponse(BaseModel):
    status: str
    database: str
    server_time_utc: datetime


class ServerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    server_id: int
    status: ScannerState
    last_success_at: datetime | None
    bases_scanned: int
    error_message: str | None


class ServerListResponse(BaseModel):
    servers: list[ServerSummary]


class TargetItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uid: str
    name: str
    alliance_tag: str | None
    hq_level: int
    x: int
    y: int
    is_shielded: bool
    shield_expires_at: datetime | None
    last_scanned_at: datetime


class TargetListResponse(BaseModel):
    server_id: int
    tab: TargetTab
    server_time_utc: datetime
    total: int
    page: int
    limit: int
    items: list[TargetItem]


class ScannerStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    server_id: int
    status: ScannerState
    last_success_at: datetime | None
    last_attempt_at: datetime
    bases_scanned: int
    consecutive_failures: int
    error_message: str | None


class IngestBaseItem(BaseModel):
    uid: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=100)
    alliance_tag: str | None = Field(default=None, max_length=16)
    hq_level: int = Field(..., ge=1, le=40)
    x: int = Field(..., ge=0, le=999)
    y: int = Field(..., ge=0, le=999)
    is_shielded: bool = False
    shield_expires_at: datetime | None = None


class IngestRequest(BaseModel):
    server_id: int = Field(..., ge=1)
    scanned_at: datetime
    bases: list[IngestBaseItem]


class IngestResponse(BaseModel):
    accepted: bool
    server_id: int
    upserted_count: int


class ScannerStatusUpdateRequest(BaseModel):
    server_id: int = Field(..., ge=1)
    status: ScannerState
    error_message: str | None = None