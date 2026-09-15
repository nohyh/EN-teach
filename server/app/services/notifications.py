"""Idempotent in-app notification delivery for stage 4 operational reminders."""
from __future__ import annotations

import json
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Assignment, AssignmentProgress, Notification, NotificationOutbox, NotificationPreference, User, WrongItem, utcnow


def _enabled(db: Session, user_id: int, field: str) -> bool:
    preference = db.get(NotificationPreference, user_id)
    return bool(getattr(preference, field)) if preference else field != "streak_reminder"


def deliver(
    db: Session, *, user_id: int, notification_type: str, title: str, body: str,
    dedupe_key: str, detail: dict | None = None,
) -> tuple[Notification, bool]:
    existing = db.query(Notification).filter_by(dedupe_key=dedupe_key).first()
    if existing:
        enqueue_outbox(db, existing)
        return existing, False
    row = Notification(
        user_id=user_id, type=notification_type, title=title, body=body,
        channel="in_app", status="delivered", dedupe_key=dedupe_key,
        detail_json=json.dumps(detail, ensure_ascii=False) if detail else None,
    )
    db.add(row); db.flush()
    enqueue_outbox(db, row)
    return row, True


def enqueue_outbox(db: Session, notification: Notification) -> int:
    created = 0
    settings = get_settings()
    for channel in settings.notification_channel_list:
        key = f"notification:{notification.id}:{channel}"
        if db.query(NotificationOutbox).filter_by(idempotency_key=key).first():
            continue
        db.add(NotificationOutbox(
            notification_id=notification.id, channel=channel, status="pending",
            attempt_count=0, max_attempts=settings.notification_max_attempts,
            next_attempt_at=utcnow(), idempotency_key=key,
        ))
        created += 1
    if created:
        db.flush()
    return created


def dispatch_due(db: Session) -> dict[str, int]:
    now = utcnow()
    day_key = now.date().isoformat()
    week = now.isocalendar()
    week_key = f"{week.year}-W{week.week:02d}"
    created = 0
    skipped = 0

    due_assignments = db.query(Assignment).filter(
        Assignment.status == "assigned",
        Assignment.due_at.is_not(None),
        Assignment.due_at >= now,
        Assignment.due_at <= now + timedelta(hours=24),
    ).all()
    for assignment in due_assignments:
        progress = db.query(AssignmentProgress).filter_by(assignment_id=assignment.id, student_id=assignment.student_id).first()
        if progress and progress.status == "completed":
            skipped += 1
            continue
        student = db.get(User, assignment.student_id)
        recipients = []
        if student and _enabled(db, student.id, "assignment_due"):
            recipients.append(student)
        parent = db.get(User, student.parent_id) if student and student.parent_id else None
        if parent and parent.is_active and _enabled(db, parent.id, "assignment_due"):
            recipients.append(parent)
        for recipient in recipients:
            _, was_created = deliver(
                db, user_id=recipient.id, notification_type="assignment_due",
                title="作业即将到期", body=f"《{assignment.title}》将在 24 小时内到期。",
                dedupe_key=f"assignment-due:{assignment.id}:{recipient.id}:{day_key}",
                detail={"assignment_id": assignment.id, "student_id": assignment.student_id, "due_at": assignment.due_at.isoformat()},
            )
            created += int(was_created); skipped += int(not was_created)

    due_students = [row[0] for row in db.query(WrongItem.user_id).filter(
        WrongItem.status == "active", WrongItem.next_review_at <= now,
    ).distinct().all()]
    for student_id in due_students:
        student = db.get(User, student_id)
        count = db.query(WrongItem).filter_by(user_id=student_id, status="active").filter(WrongItem.next_review_at <= now).count()
        recipients = []
        if student and _enabled(db, student.id, "review_due"):
            recipients.append(student)
        parent = db.get(User, student.parent_id) if student and student.parent_id else None
        if parent and parent.is_active and _enabled(db, parent.id, "review_due"):
            recipients.append(parent)
        for recipient in recipients:
            _, was_created = deliver(
                db, user_id=recipient.id, notification_type="review_due",
                title="今天有错题需要复习", body=f"有 {count} 个知识点到了复习时间。",
                dedupe_key=f"review-due:{student_id}:{recipient.id}:{day_key}",
                detail={"student_id": student_id, "item_count": count},
            )
            created += int(was_created); skipped += int(not was_created)

    parents = db.query(User).filter_by(role="parent", is_active=True).all()
    for parent in parents:
        if not _enabled(db, parent.id, "weekly_report"):
            continue
        child_count = db.query(User).filter_by(parent_id=parent.id, role="student", is_active=True).count()
        if not child_count:
            continue
        _, was_created = deliver(
            db, user_id=parent.id, notification_type="weekly_report",
            title="本周学习报告已生成", body="看看孩子本周的进步和需要协助的知识点吧。",
            dedupe_key=f"weekly-report:{parent.id}:{week_key}", detail={"child_count": child_count, "week": week_key},
        )
        created += int(was_created); skipped += int(not was_created)

    return {"created": created, "skipped": skipped}


def payload(row: Notification) -> dict:
    return {
        "id": row.id, "type": row.type, "title": row.title, "body": row.body,
        "channel": row.channel, "status": row.status,
        "detail": json.loads(row.detail_json) if row.detail_json else None,
        "delivered_at": row.delivered_at, "read_at": row.read_at,
    }
