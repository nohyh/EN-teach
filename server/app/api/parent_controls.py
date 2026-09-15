"""Parent learning-policy management and student usage heartbeat endpoints."""
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.db.database import get_db
from app.db.models import User
from app.services import operations, parent_controls


router = APIRouter(prefix="/api/v1", tags=["parent-controls"])


class LearningPolicyUpdate(BaseModel):
    learning_enabled: bool
    daily_limit_minutes: int = Field(ge=5, le=240)
    allowed_start: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    allowed_end: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    timezone: str = Field(min_length=1, max_length=64)
    voice_enabled: bool
    ai_enabled: bool

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as error:
            raise ValueError("无效的时区") from error
        return value


class UsageHeartbeat(BaseModel):
    idempotency_key: str = Field(min_length=12, max_length=96, pattern=r"^[A-Za-z0-9_.:-]+$")
    active_seconds: int = Field(ge=1, le=300)


def _bound_child(db: Session, parent: User, student_id: int) -> User:
    student = db.get(User, student_id)
    if not student or student.role != "student" or student.parent_id != parent.id:
        raise HTTPException(status_code=404, detail="没有找到已绑定的孩子")
    return student


@router.get("/parent/children/{student_id}/learning-policy")
def get_child_policy(
    student_id: int,
    parent: User = Depends(require_roles("parent")),
    db: Session = Depends(get_db),
):
    student = _bound_child(db, parent, student_id)
    payload = parent_controls.access_status(db, student)
    db.commit()
    return payload


@router.put("/parent/children/{student_id}/learning-policy")
def update_child_policy(
    student_id: int,
    request: LearningPolicyUpdate,
    parent: User = Depends(require_roles("parent")),
    db: Session = Depends(get_db),
):
    student = _bound_child(db, parent, student_id)
    policy = parent_controls.get_or_create_policy(db, student)
    policy.is_configured = True
    for key, value in request.model_dump().items():
        setattr(policy, key, value)
    operations.audit(
        db, parent.id, "learning_policy.update", "student", student.id,
        detail=request.model_dump(),
    )
    db.commit()
    return parent_controls.access_status(db, student)


@router.get("/me/learning-policy")
def get_own_policy(
    student: User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    payload = parent_controls.access_status(db, student)
    db.commit()
    return payload


@router.post("/me/usage-heartbeats")
def usage_heartbeat(
    request: UsageHeartbeat,
    student: User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    try:
        status, duplicate, recorded = parent_controls.record_usage(
            db, student, request.idempotency_key, request.active_seconds,
        )
    except parent_controls.LearningAccessDenied as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {**status, "duplicate": duplicate, "recorded_seconds": recorded}
