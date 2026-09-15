"""Authoritative learning events, progress, wrong-book and spaced review rules."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import (
    Assignment, AssignmentProgress, Course, CourseVersion, KnowledgePoint, LearningEvent,
    LearningProgress, ReviewSession, WrongAttempt, WrongItem, utcnow,
)
from app.services import economy


REVIEW_INTERVALS = (1, 3, 7, 14, 30)


def naive_utc(value: datetime | None = None) -> datetime:
    value = value or datetime.now(timezone.utc)
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _progress_payload(progress: LearningProgress) -> dict:
    return {
        "id": progress.id, "course_ref": progress.course_ref, "course_id": progress.course_id,
        "course_version_id": progress.course_version_id, "client_progress_key": progress.client_progress_key,
        "section_id": progress.section_id, "completed_activities": progress.completed_activities,
        "total_activities": progress.total_activities, "status": progress.status,
        "completed_at": progress.completed_at, "updated_at": progress.updated_at,
    }


def list_progress(db: Session, user_id: int) -> list[dict]:
    rows = db.query(LearningProgress).filter_by(user_id=user_id).order_by(LearningProgress.updated_at.desc()).all()
    return [_progress_payload(row) for row in rows]


def _get_or_create_knowledge(db: Session, event: LearningEvent) -> KnowledgePoint:
    identity = "|".join([
        event.course_ref, event.section_id, event.knowledge_key or event.activity_type,
        (event.correct_answer or event.prompt).strip().casefold(),
    ])
    key = hashlib.sha256(identity.encode()).hexdigest()
    point = db.query(KnowledgePoint).filter_by(canonical_key=key).first()
    if point:
        return point
    point = KnowledgePoint(
        canonical_key=key, kind=event.activity_type, standard_content=event.prompt,
        correct_answer=event.correct_answer, course_ref=event.course_ref,
        section_id=event.section_id, tags_json="[]",
    )
    db.add(point)
    db.flush()
    return point


def _record_wrong(db: Session, event: LearningEvent) -> WrongItem:
    now = utcnow()
    point = _get_or_create_knowledge(db, event)
    item = db.query(WrongItem).filter_by(user_id=event.user_id, knowledge_point_id=point.id).first()
    if item:
        item.source_event_id = event.id
        item.error_count += 1
        item.correct_streak = 0
        item.mastery_level = max(0, item.mastery_level - 1)
        item.status = "active"
        item.next_review_at = now + timedelta(days=1)
        item.last_wrong_at = now
        item.mastered_at = None
        return item
    item = WrongItem(
        user_id=event.user_id, knowledge_point_id=point.id, source_event_id=event.id,
        error_count=1, review_count=0, mastery_level=0, correct_streak=0,
        status="active", next_review_at=now + timedelta(days=1), last_wrong_at=now,
    )
    db.add(item)
    return item


def _update_assignment_progress(db: Session, event: LearningEvent) -> None:
    assignments = db.query(Assignment).filter_by(
        student_id=event.user_id, course_ref=event.course_ref, section_id=event.section_id, status="assigned",
    ).all()
    now = utcnow()
    for assignment in assignments:
        progress = db.query(AssignmentProgress).filter_by(assignment_id=assignment.id, student_id=event.user_id).first()
        if not progress:
            progress = AssignmentProgress(assignment_id=assignment.id, student_id=event.user_id)
            db.add(progress)
        progress.completed_activities = max(progress.completed_activities or 0, event.activity_index + 1)
        progress.status = "completed" if progress.completed_activities >= assignment.total_activities else "in_progress"
        if progress.status == "completed" and progress.completed_at is None:
            progress.completed_at = now


def _component_prompt(component: dict) -> str:
    return str(component.get("word") or component.get("sentence") or component.get("prompt") or component.get("content") or component.get("opening") or "")


def _component_answer(component: dict) -> str:
    return str(component.get("answer") or component.get("meaning") or component.get("content") or component.get("goal") or "")


def record_learning_event(db: Session, user_id: int, data) -> tuple[LearningEvent, LearningProgress, bool]:
    existing = db.query(LearningEvent).filter_by(idempotency_key=data.idempotency_key).first()
    if existing:
        if existing.user_id != user_id:
            raise ValueError("幂等键已被其他用户使用")
        progress = db.query(LearningProgress).filter_by(user_id=user_id, client_progress_key=existing.client_progress_key).one()
        return existing, progress, True
    resolved_version_id = data.course_version_id
    prompt = data.prompt
    correct_answer = data.correct_answer
    if data.course_id:
        course = db.get(Course, data.course_id)
        if not course:
            raise ValueError("课程不存在")
        version = db.get(CourseVersion, resolved_version_id or course.current_version_id)
        if not version or version.course_id != course.id:
            raise ValueError("课程版本与课程不匹配")
        resolved_version_id = version.id
        content = json.loads(version.content_json)
        section = next((item for item in content.get("sections", []) if item.get("id") == data.section_id), None)
        if not section or data.activity_index >= len(section.get("activities", [])):
            raise ValueError("课程活动不存在")
        component = section["activities"][data.activity_index]
        if component.get("type") != data.activity_type or data.total_activities != len(section["activities"]):
            raise ValueError("课程活动契约与发布版本不一致")
        prompt = _component_prompt(component)
        correct_answer = _component_answer(component)
    event = LearningEvent(
        idempotency_key=data.idempotency_key, user_id=user_id, course_ref=data.course_ref,
        course_id=data.course_id, course_version_id=resolved_version_id,
        client_progress_key=data.client_progress_key, section_id=data.section_id,
        activity_index=data.activity_index, activity_type=data.activity_type,
        knowledge_key=data.knowledge_key, prompt=prompt, correct_answer=correct_answer,
        user_answer=data.user_answer, correct=data.correct,
        score_json=json.dumps(data.score, ensure_ascii=False) if data.score is not None else None,
        occurred_at=naive_utc(data.occurred_at),
    )
    db.add(event)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existing = db.query(LearningEvent).filter_by(idempotency_key=data.idempotency_key).first()
        if not existing or existing.user_id != user_id:
            raise
        progress = db.query(LearningProgress).filter_by(user_id=user_id, client_progress_key=existing.client_progress_key).one()
        return existing, progress, True
    progress = db.query(LearningProgress).filter_by(user_id=user_id, client_progress_key=data.client_progress_key).first()
    was_completed = progress is not None and progress.status == "completed"
    if not progress:
        progress = LearningProgress(
            user_id=user_id, course_ref=data.course_ref, course_id=data.course_id,
            course_version_id=resolved_version_id, client_progress_key=data.client_progress_key,
            section_id=data.section_id, completed_activities=0, total_activities=data.total_activities,
        )
        db.add(progress)
    progress.completed_activities = max(progress.completed_activities or 0, data.completed_activities)
    progress.total_activities = max(progress.total_activities or 0, data.total_activities)
    progress.status = "completed" if progress.completed_activities >= progress.total_activities else "in_progress"
    if progress.status == "completed" and progress.completed_at is None:
        progress.completed_at = utcnow()
    if not data.correct:
        _record_wrong(db, event)
    _update_assignment_progress(db, event)
    economy.reward_learning_event(db, event, progress, newly_completed=progress.status == "completed" and not was_completed)
    economy.sync_badges(db, user_id)
    db.commit()
    db.refresh(event); db.refresh(progress)
    return event, progress, False


def wrong_item_payload(db: Session, item: WrongItem) -> dict:
    point = db.get(KnowledgePoint, item.knowledge_point_id)
    return {
        "id": item.id, "knowledge_point_id": item.knowledge_point_id,
        "kind": point.kind, "prompt": point.standard_content, "correct_answer": point.correct_answer,
        "course_ref": point.course_ref, "section_id": point.section_id,
        "error_count": item.error_count, "review_count": item.review_count,
        "mastery_level": item.mastery_level, "correct_streak": item.correct_streak,
        "status": item.status, "next_review_at": item.next_review_at,
        "last_wrong_at": item.last_wrong_at, "mastered_at": item.mastered_at,
    }


def list_wrong_items(db: Session, user_id: int, status: str | None = None) -> list[dict]:
    query = db.query(WrongItem).filter_by(user_id=user_id)
    if status:
        query = query.filter(WrongItem.status == status)
    rows = query.order_by(WrongItem.next_review_at, WrongItem.error_count.desc()).all()
    return [wrong_item_payload(db, row) for row in rows]


def create_review_session(db: Session, user_id: int, max_items: int) -> ReviewSession:
    now = utcnow()
    items = db.query(WrongItem).filter(
        WrongItem.user_id == user_id, WrongItem.status == "active", WrongItem.next_review_at <= now,
    ).order_by(WrongItem.next_review_at, WrongItem.error_count.desc()).limit(max_items).all()
    if not items:
        raise ValueError("今天没有到期错题")
    session = ReviewSession(user_id=user_id, status="active", item_ids_json=json.dumps([item.id for item in items]), item_count=len(items))
    db.add(session); db.commit(); db.refresh(session)
    return session


def answer_review(db: Session, user_id: int, session: ReviewSession, item: WrongItem, data) -> tuple[WrongAttempt, bool]:
    existing = db.query(WrongAttempt).filter_by(idempotency_key=data.idempotency_key).first()
    if existing:
        existing_item = db.get(WrongItem, existing.wrong_item_id)
        if not existing_item or existing_item.user_id != user_id or existing.wrong_item_id != item.id or existing.review_session_id != session.id:
            raise ValueError("幂等键已被其他复习记录使用")
        return existing, True
    if session.user_id != user_id or session.status != "active":
        raise ValueError("复习会话不可用")
    if item.user_id != user_id or item.id not in json.loads(session.item_ids_json):
        raise ValueError("错题不在当前复习会话中")
    if db.query(WrongAttempt).filter_by(review_session_id=session.id, wrong_item_id=item.id).first():
        raise ValueError("本会话已经回答过该错题")
    now = utcnow()
    item.review_count += 1
    item.last_review_at = now
    was_mastered = item.status == "mastered"
    if data.correct:
        item.correct_streak += 1
        item.mastery_level = min(4, item.mastery_level + 1)
        interval = REVIEW_INTERVALS[item.mastery_level]
        if item.correct_streak >= 3 and item.mastery_level >= 3:
            item.status = "mastered"; item.mastered_at = now
    else:
        item.correct_streak = 0; item.mastery_level = 0; item.status = "active"; item.mastered_at = None
        interval = 1
    item.next_review_at = now + timedelta(days=interval)
    attempt = WrongAttempt(
        idempotency_key=data.idempotency_key, wrong_item_id=item.id, review_session_id=session.id,
        user_answer=data.user_answer, correct=data.correct,
        score_json=json.dumps(data.score, ensure_ascii=False) if data.score is not None else None,
        interval_days=interval,
    )
    db.add(attempt)
    session.answered_count += 1
    if data.correct: session.correct_count += 1
    if session.answered_count >= session.item_count:
        session.status = "completed"; session.completed_at = now
    if item.status == "mastered" and not was_mastered:
        economy.award(db, user_id, "wrong_item_mastered", str(item.id))
    economy.sync_badges(db, user_id)
    db.commit(); db.refresh(attempt); db.refresh(item); db.refresh(session)
    return attempt, False
