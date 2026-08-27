"""SentenceAttempt 的 DB 访问"""
from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.db import models


def list_attempts_for_sentence(
    db: Session, user_id: int, sentence_id: str, limit: int = 20
) -> list[dict]:
    rows = (
        db.query(models.SentenceAttempt)
        .filter_by(user_id=user_id, sentence_id=sentence_id)
        .order_by(models.SentenceAttempt.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "overall": r.overall,
            "passed": r.passed,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


def insert_attempt(
    db: Session,
    *,
    user_id: int,
    sentence_id: str,
    audio_path: str,
    overall: float,
    accuracy: float,
    fluency: float,
    integrity: float,
    passed: bool,
    word_scores: list[dict],
    raw: dict,
) -> models.SentenceAttempt:
    attempt = models.SentenceAttempt(
        user_id=user_id,
        sentence_id=sentence_id,
        audio_path=audio_path,
        overall=overall,
        accuracy=accuracy,
        fluency=fluency,
        integrity=integrity,
        passed=passed,
        word_scores_json=json.dumps(word_scores, ensure_ascii=False),
        raw_json=json.dumps(raw, ensure_ascii=False),
    )
    db.add(attempt)
    return attempt


def passed_sentence_ids_in(db: Session, user_id: int, sentence_ids: list[str]) -> set[str]:
    rows = (
        db.query(models.SentenceAttempt.sentence_id)
        .filter_by(user_id=user_id, passed=True)
        .filter(models.SentenceAttempt.sentence_id.in_(sentence_ids))
        .all()
    )
    return {r.sentence_id for r in rows}


def mark_unit_completed(db: Session, user_id: int, unit_id: str) -> None:
    progress = (
        db.query(models.UnitProgress)
        .filter_by(user_id=user_id, unit_id=unit_id)
        .first()
    )
    now = datetime.utcnow()
    if not progress:
        progress = models.UnitProgress(
            user_id=user_id, unit_id=unit_id,
            status="completed", completed_at=now,
        )
        db.add(progress)
    else:
        progress.status = "completed"
        progress.completed_at = now


def mark_unit_in_progress(db: Session, user_id: int, unit_id: str) -> None:
    progress = (
        db.query(models.UnitProgress)
        .filter_by(user_id=user_id, unit_id=unit_id)
        .first()
    )
    if not progress:
        progress = models.UnitProgress(
            user_id=user_id, unit_id=unit_id, status="in_progress"
        )
        db.add(progress)
