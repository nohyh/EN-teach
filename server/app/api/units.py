"""GET /api/v1/units, GET /api/v1/units/{id}/sentences

只做参数解析 / HTTP 编码, 业务在 services/, DB 在 repositories/
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.repositories import units as units_repo

router = APIRouter(prefix="/api/v1/units", tags=["units"])


@router.get("")
def list_units(
    user_id: Optional[int] = Query(None, description="查指定用户进度"),
    db: Session = Depends(get_db),
):
    return units_repo.get_units_with_progress(db, user_id)


@router.get("/{unit_id}/sentences")
def get_unit_sentences(unit_id: str, db: Session = Depends(get_db)):
    sentences = units_repo.get_sentences_for_unit(db, unit_id)
    if sentences is None:
        raise HTTPException(status_code=404, detail="Unit not found")
    return sentences
