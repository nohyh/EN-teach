"""units / sentences 的 DB 访问

只负责 SQL, 不写业务判断 (业务在 services/)
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.db import models


def get_units_with_progress(db: Session, user_id: int | None) -> list[dict]:
    units = db.query(models.Unit).order_by(models.Unit.order).all()
    progress_map: dict[str, str] = {}
    if user_id is not None:
        progresses = db.query(models.UnitProgress).filter_by(user_id=user_id).all()
        progress_map = {p.unit_id: p.status for p in progresses}

    return [
        {
            "id": u.id,
            "name": u.name,
            "description": u.description,
            "order": u.order,
            "sentence_count": len(u.sentences),
            "progress": progress_map.get(u.id, "not_started"),
        }
        for u in units
    ]


def get_sentences_for_unit(db: Session, unit_id: str) -> list[dict] | None:
    unit = db.query(models.Unit).filter_by(id=unit_id).first()
    if not unit:
        return None
    return [
        {
            "id": s.id,
            "text": s.text,
            "translation": s.translation,
            "audio_url": s.audio_url,
            "order": s.order,
            "source": s.source,
        }
        for s in unit.sentences
    ]


def get_sentence(db: Session, sentence_id: str) -> models.Sentence | None:
    return db.query(models.Sentence).filter_by(id=sentence_id).first()
