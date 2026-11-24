from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import MapBase, ScannerStatus
from app.schemas import (
    ScannerStatusResponse,
    ServerListResponse,
    ServerSummary,
    SortOption,
    TargetItem,
    TargetListResponse,
    TargetTab,
)

router = APIRouter(prefix="/api", tags=["targets"])


@router.get("/servers", response_model=ServerListResponse)
def list_servers(db: Session = Depends(get_db)) -> ServerListResponse:
    stmt = select(ScannerStatus).order_by(ScannerStatus.server_id.asc())
    rows = db.scalars(stmt).all()
    return ServerListResponse(
        servers=[ServerSummary.model_validate(row) for row in rows]
    )


@router.get("/targets", response_model=TargetListResponse)
def list_targets(
    server_id: int = Query(..., ge=1),
    tab: TargetTab = Query(...),
    min_hq: int | None = Query(default=None, ge=1, le=40),
    max_hq: int | None = Query(default=None, ge=1, le=40),
    alliance_tag: str | None = Query(default=None, max_length=16),
    search: str | None = Query(default=None, max_length=100),
    sort_by: SortOption | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> TargetListResponse:
    now_utc = datetime.now(timezone.utc)
    conditions = [MapBase.server_id == server_id]

    if tab == "unshielded":
        conditions.append(
            or_(
                MapBase.is_shielded.is_(False),
                MapBase.shield_expires_at.is_(None),
                MapBase.shield_expires_at <= now_utc,
            )
        )
    else:
        conditions.append(
            and_(
                MapBase.is_shielded.is_(True),
                MapBase.shield_expires_at.is_not(None),
                MapBase.shield_expires_at > now_utc,
            )
        )

    if min_hq is not None:
        conditions.append(MapBase.hq_level >= min_hq)
    if max_hq is not None:
        conditions.append(MapBase.hq_level <= max_hq)
    if alliance_tag:
        conditions.append(MapBase.alliance_tag.ilike(f"%{alliance_tag.strip()}%"))
    if search:
        pattern = f"%{search.strip()}%"
        conditions.append(
            or_(
                MapBase.name.ilike(pattern),
                MapBase.alliance_tag.ilike(pattern),
            )
        )

    effective_sort = sort_by or ("hq_desc" if tab == "unshielded" else "expires_asc")
    if effective_sort == "hq_desc":
        order_clauses = [MapBase.hq_level.desc(), MapBase.name.asc()]
    elif effective_sort == "hq_asc":
        order_clauses = [MapBase.hq_level.asc(), MapBase.name.asc()]
    elif effective_sort == "expires_asc":
        order_clauses = [MapBase.shield_expires_at.asc().nullslast(), MapBase.hq_level.desc()]
    else:
        order_clauses = [MapBase.name.asc()]

    total_stmt = select(func.count()).select_from(MapBase).where(*conditions)
    total = db.scalar(total_stmt) or 0

    offset = (page - 1) * limit
    items_stmt = (
        select(MapBase)
        .where(*conditions)
        .order_by(*order_clauses)
        .offset(offset)
        .limit(limit)
    )
    rows = db.scalars(items_stmt).all()

    return TargetListResponse(
        server_id=server_id,
        tab=tab,
        server_time_utc=now_utc,
        total=total,
        page=page,
        limit=limit,
        items=[TargetItem.model_validate(row) for row in rows],
    )


@router.get("/scanner/status/{server_id}", response_model=ScannerStatusResponse)
def get_scanner_status(
    server_id: int,
    db: Session = Depends(get_db),
) -> ScannerStatusResponse:
    record = db.get(ScannerStatus, server_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scanner status for server {server_id} not found",
        )
    return ScannerStatusResponse.model_validate(record)