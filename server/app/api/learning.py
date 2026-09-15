"""Cloud learning progress, wrong-book and spaced-review APIs."""
import json
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.db.models import ReviewSession, User, WrongItem
from app.services import learning_loop, parent_controls


router = APIRouter(prefix="/api/v1/me", tags=["learning-loop"])


class LearningEventRequest(BaseModel):
    idempotency_key: str = Field(min_length=12, max_length=64, pattern=r"^[A-Za-z0-9_.:-]+$")
    course_ref: str = Field(min_length=1, max_length=128)
    course_id: int | None = None
    course_version_id: int | None = None
    client_progress_key: str = Field(min_length=1, max_length=128)
    section_id: str = Field(min_length=1, max_length=96)
    activity_index: int = Field(ge=0, le=5000)
    activity_type: Literal["word", "sentence", "recall", "pronunciation", "dialog"]
    knowledge_key: str | None = Field(default=None, max_length=160)
    prompt: str = Field(min_length=1, max_length=2000)
    correct_answer: str | None = Field(default=None, max_length=2000)
    user_answer: str | None = Field(default=None, max_length=2000)
    correct: bool
    score: dict[str, Any] | None = None
    completed_activities: int = Field(ge=0, le=5000)
    total_activities: int = Field(ge=1, le=5000)
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReviewSessionRequest(BaseModel):
    max_items: int = Field(default=15, ge=1, le=30)


class ReviewAnswerRequest(BaseModel):
    idempotency_key: str = Field(min_length=12, max_length=64, pattern=r"^[A-Za-z0-9_.:-]+$")
    wrong_item_id: int
    correct: bool
    user_answer: str | None = Field(default=None, max_length=2000)
    score: dict[str, Any] | None = None


@router.post("/learning-events", status_code=201)
def record_event(request: LearningEventRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        parent_controls.ensure_access(db, user)
        event, progress, duplicate = learning_loop.record_learning_event(db, user.id, request)
    except parent_controls.LearningAccessDenied as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {"event_id": event.id, "duplicate": duplicate, "progress": learning_loop._progress_payload(progress)}


@router.get("/progress")
def progress(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return learning_loop.list_progress(db, user.id)


@router.get("/wrong-items")
def wrong_items(
    status: Literal["active", "mastered"] | None = Query(None),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    return learning_loop.list_wrong_items(db, user.id, status=status)


@router.get("/reviews/due")
def due_reviews(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = learning_loop.utcnow()
    rows = db.query(WrongItem).filter(WrongItem.user_id == user.id, WrongItem.status == "active", WrongItem.next_review_at <= now).order_by(WrongItem.next_review_at).limit(30).all()
    return [learning_loop.wrong_item_payload(db, row) for row in rows]


@router.post("/review-sessions", status_code=201)
def start_review(request: ReviewSessionRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        parent_controls.ensure_access(db, user)
        session = learning_loop.create_review_session(db, user.id, request.max_items)
    except parent_controls.LearningAccessDenied as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    items = [db.get(WrongItem, item_id) for item_id in json.loads(session.item_ids_json)]
    return {"id": session.id, "status": session.status, "item_count": session.item_count, "items": [learning_loop.wrong_item_payload(db, item) for item in items if item]}


@router.post("/review-sessions/{session_id}/answers")
def submit_review_answer(session_id: int, request: ReviewAnswerRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.get(ReviewSession, session_id); item = db.get(WrongItem, request.wrong_item_id)
    if not session or not item:
        raise HTTPException(status_code=404, detail="复习会话或错题不存在")
    try:
        parent_controls.ensure_access(db, user)
        attempt, duplicate = learning_loop.answer_review(db, user.id, session, item, request)
    except parent_controls.LearningAccessDenied as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {"attempt_id": attempt.id, "duplicate": duplicate, "interval_days": attempt.interval_days, "item": learning_loop.wrong_item_payload(db, item), "session": {"id": session.id, "status": session.status, "answered_count": session.answered_count, "correct_count": session.correct_count}}
