"""Parent-managed study access and idempotent active-time accounting."""
from __future__ import annotations

from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.db.models import DailyLearningUsage, LearningUsageEvent, StudentLearningPolicy, User, utcnow


class LearningAccessDenied(ValueError):
    """Raised when a student's current policy blocks an operation."""


REASON_MESSAGES = {
    "learning_disabled": "家长已暂停学习功能",
    "outside_allowed_time": "当前不在家长设置的可学习时段内",
    "daily_limit_reached": "今天的学习时长已达到家长设置的上限",
    "voice_disabled": "家长已关闭语音功能",
    "ai_disabled": "家长已关闭 AI 对话功能",
}


def get_or_create_policy(db: Session, student: User) -> StudentLearningPolicy:
    policy = db.get(StudentLearningPolicy, student.id)
    if policy:
        if policy.parent_id != student.parent_id:
            policy.parent_id = student.parent_id
        return policy
    policy = StudentLearningPolicy(student_id=student.id, parent_id=student.parent_id)
    db.add(policy)
    db.flush()
    return policy


def _local_now(policy: StudentLearningPolicy, now: datetime | None = None) -> datetime:
    try:
        zone = ZoneInfo(policy.timezone)
    except ZoneInfoNotFoundError:
        zone = timezone.utc
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.astimezone(zone)


def _inside_window(policy: StudentLearningPolicy, current: time) -> bool:
    start = time.fromisoformat(policy.allowed_start)
    end = time.fromisoformat(policy.allowed_end)
    if start == end:
        return True
    if start < end:
        return start <= current < end
    return current >= start or current < end


def access_status(db: Session, student: User, now: datetime | None = None) -> dict:
    policy = get_or_create_policy(db, student)
    local = _local_now(policy, now)
    usage = db.query(DailyLearningUsage).filter_by(student_id=student.id, usage_date=local.date()).first()
    used_seconds = usage.active_seconds if usage else 0
    reason = None
    if not policy.is_configured:
        reason = None
    elif not policy.learning_enabled:
        reason = "learning_disabled"
    elif not _inside_window(policy, local.time().replace(tzinfo=None)):
        reason = "outside_allowed_time"
    elif used_seconds >= policy.daily_limit_minutes * 60:
        reason = "daily_limit_reached"
    return {
        "settings": {
            "is_configured": policy.is_configured,
            "learning_enabled": policy.learning_enabled,
            "daily_limit_minutes": policy.daily_limit_minutes,
            "allowed_start": policy.allowed_start,
            "allowed_end": policy.allowed_end,
            "timezone": policy.timezone,
            "voice_enabled": policy.voice_enabled,
            "ai_enabled": policy.ai_enabled,
            "updated_at": policy.updated_at,
        },
        "usage": {
            "date": local.date(),
            "active_seconds": used_seconds,
            "used_minutes": round(used_seconds / 60, 1),
            "remaining_minutes": round(max(0, policy.daily_limit_minutes * 60 - used_seconds) / 60, 1),
        },
        "access": {"allowed": reason is None, "reason": reason, "message": REASON_MESSAGES.get(reason) if reason else None},
    }


def ensure_access(db: Session, user: User | None, feature: str | None = None) -> None:
    if not user or user.role != "student":
        return
    status = access_status(db, user)
    reason = status["access"]["reason"]
    policy = db.get(StudentLearningPolicy, user.id)
    if not reason and feature == "voice" and policy and policy.is_configured and not policy.voice_enabled:
        reason = "voice_disabled"
    if not reason and feature == "ai" and policy and policy.is_configured and not policy.ai_enabled:
        reason = "ai_disabled"
    if reason:
        raise LearningAccessDenied(REASON_MESSAGES[reason])


def record_usage(db: Session, student: User, idempotency_key: str, active_seconds: int) -> tuple[dict, bool, int]:
    existing = db.query(LearningUsageEvent).filter_by(idempotency_key=idempotency_key).first()
    if existing:
        if existing.student_id != student.id:
            raise ValueError("计时请求标识已被其他账号使用")
        return access_status(db, student), True, existing.active_seconds

    ensure_access(db, student)
    policy = get_or_create_policy(db, student)
    local = _local_now(policy)
    usage = db.query(DailyLearningUsage).filter_by(student_id=student.id, usage_date=local.date()).with_for_update().first()
    if not usage:
        usage = DailyLearningUsage(student_id=student.id, usage_date=local.date(), active_seconds=0)
        db.add(usage)
        db.flush()
    remaining = max(0, policy.daily_limit_minutes * 60 - usage.active_seconds)
    recorded = min(active_seconds, remaining) if policy.is_configured else active_seconds
    if recorded <= 0:
        raise LearningAccessDenied(REASON_MESSAGES["daily_limit_reached"])
    usage.active_seconds += recorded
    usage.updated_at = utcnow()
    db.add(LearningUsageEvent(
        student_id=student.id, idempotency_key=idempotency_key,
        active_seconds=recorded, usage_date=local.date(),
    ))
    db.commit()
    return access_status(db, student), False, recorded
