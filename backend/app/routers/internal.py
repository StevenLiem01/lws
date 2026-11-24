from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import MapBase, ScannerStatus
from app.schemas import (
    IngestRequest,
    IngestResponse,
    ScannerStatusResponse,
    ScannerStatusUpdateRequest,
)
from app.security import verify_internal_secret

router = APIRouter(
    prefix="/internal",
    tags=["internal"],
    dependencies=[Depends(verify_internal_secret)],
)


@router.post("/ingest", response_model=IngestResponse)
def ingest_bases(
    payload: IngestRequest,
    db: Session = Depends(get_db),
) -> IngestResponse:
    now_utc = datetime.now(timezone.utc)
    upserted_count = 0

    if payload.bases:
        values = [
            {
                "server_id": payload.server_id,
                "uid": base.uid,
                "name": base.name,
                "alliance_tag": base.alliance_tag,
                "hq_level": base.hq_level,
                "x": base.x,
                "y": base.y,
                "is_shielded": base.is_shielded,
                "shield_expires_at": base.shield_expires_at,
                "last_scanned_at": payload.scanned_at,
                "updated_at": now_utc,
            }
            for base in payload.bases
        ]

        stmt = pg_insert(MapBase).values(values)
        stmt = stmt.on_conflict_do_update(
            index_elements=["server_id", "uid"],
            set_={
                "name": stmt.excluded.name,
                "alliance_tag": stmt.excluded.alliance_tag,
                "hq_level": stmt.excluded.hq_level,
                "x": stmt.excluded.x,
                "y": stmt.excluded.y,
                "is_shielded": stmt.excluded.is_shielded,
                "shield_expires_at": stmt.excluded.shield_expires_at,
                "last_scanned_at": stmt.excluded.last_scanned_at,
                "updated_at": stmt.excluded.updated_at,
            },
        )
        db.execute(stmt)
        upserted_count = len(values)

    status_stmt = pg_insert(ScannerStatus).values(
        server_id=payload.server_id,
        status="idle",
        last_success_at=payload.scanned_at,
        last_attempt_at=payload.scanned_at,
        bases_scanned=upserted_count,
        consecutive_failures=0,
        error_message=None,
        updated_at=now_utc,
    )
    status_stmt = status_stmt.on_conflict_do_update(
        index_elements=["server_id"],
        set_={
            "status": status_stmt.excluded.status,
            "last_success_at": status_stmt.excluded.last_success_at,
            "last_attempt_at": status_stmt.excluded.last_attempt_at,
            "bases_scanned": status_stmt.excluded.bases_scanned,
            "consecutive_failures": 0,
            "error_message": None,
            "updated_at": status_stmt.excluded.updated_at,
        },
    )
    db.execute(status_stmt)
    db.commit()

    return IngestResponse(
        accepted=True,
        server_id=payload.server_id,
        upserted_count=upserted_count,
    )


@router.post("/scanner/status", response_model=ScannerStatusResponse)
def update_scanner_status(
    payload: ScannerStatusUpdateRequest,
    db: Session = Depends(get_db),
) -> ScannerStatusResponse:
    now_utc = datetime.now(timezone.utc)
    record = db.get(ScannerStatus, payload.server_id)

    if record is None:
        failures = 1 if payload.status in ("rate_limited", "error") else 0
        record = ScannerStatus(
            server_id=payload.server_id,
            status=payload.status,
            last_success_at=now_utc if payload.status == "idle" else None,
            last_attempt_at=now_utc,
            bases_scanned=0,
            consecutive_failures=failures,
            error_message=payload.error_message,
            updated_at=now_utc,
        )
        db.add(record)
    else:
        record.status = payload.status
        record.last_attempt_at = now_utc
        record.error_message = payload.error_message
        record.updated_at = now_utc
        if payload.status in ("rate_limited", "error"):
            record.consecutive_failures += 1
        elif payload.status == "idle":
            record.consecutive_failures = 0
            record.last_success_at = now_utc

    db.commit()
    db.refresh(record)
    return ScannerStatusResponse.model_validate(record)