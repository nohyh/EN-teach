"""Stage 4 classroom operations, teacher analytics, parent reports and audit APIs."""
from __future__ import annotations

import csv
import json
import secrets
from datetime import datetime, timedelta
from io import StringIO
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_roles
from app.db.database import get_db
from app.db.models import (
    Assignment, AssignmentBatch, AssignmentProgress, AuditLog, ClassMembership, Classroom,
    KnowledgePoint, LearningEvent, LearningProgress, NotificationPreference,
    Notification, NotificationOutbox, WrongItem, User, utcnow,
)
from app.services import economy, notification_delivery, notifications as notification_service, operations
from app.services.learning_loop import naive_utc


router = APIRouter(prefix="/api/v1", tags=["operations"])


class ClassroomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class ClassroomJoin(BaseModel):
    invite_code: str = Field(min_length=6, max_length=16, pattern=r"^[A-Za-z0-9]+$")


class ClassAssignmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    course_ref: str = Field(min_length=1, max_length=128)
    section_id: str = Field(min_length=1, max_length=96)
    total_activities: int = Field(ge=1, le=5000)
    starts_at: datetime | None = None
    due_at: datetime | None = None
    allow_late: bool = True
    instructions: str = Field(default="", max_length=2000)


class AssignmentBatchPatch(BaseModel):
    revision: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    starts_at: datetime | None = None
    due_at: datetime | None = None
    allow_late: bool | None = None
    instructions: str | None = Field(default=None, max_length=2000)


class NotificationPreferenceUpdate(BaseModel):
    weekly_report: bool
    assignment_due: bool
    review_due: bool
    streak_reminder: bool


class PointsAdjustmentRequest(BaseModel):
    student_id: int
    amount: int = Field(ge=-1_000_000, le=1_000_000)
    reason: str = Field(min_length=3, max_length=500)
    idempotency_key: str = Field(min_length=12, max_length=120, pattern=r"^[A-Za-z0-9_.:-]+$")


def _new_invite_code(db: Session) -> str:
    for _ in range(10):
        code = secrets.token_hex(4).upper()
        if not db.query(Classroom).filter_by(invite_code=code).first():
            return code
    raise RuntimeError("无法生成班级邀请码")


def _class_or_error(db: Session, classroom_id: int, user: User) -> Classroom:
    try:
        return operations.require_classroom(db, classroom_id, user)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


def _batch_payload(db: Session, batch: AssignmentBatch) -> dict:
    assignments = db.query(Assignment).filter_by(batch_id=batch.id).all()
    assignment_ids = [row.id for row in assignments]
    completed = db.query(AssignmentProgress).filter(
        AssignmentProgress.assignment_id.in_(assignment_ids), AssignmentProgress.status == "completed",
    ).count() if assignment_ids else 0
    return {
        "id": batch.id, "classroom_id": batch.classroom_id, "teacher_id": batch.teacher_id,
        "title": batch.title, "course_ref": batch.course_ref, "section_id": batch.section_id,
        "total_activities": batch.total_activities, "starts_at": batch.starts_at, "due_at": batch.due_at,
        "allow_late": batch.allow_late, "instructions": batch.instructions or "",
        "status": batch.status, "revision": batch.revision,
        "student_count": len(assignments), "completed_count": completed,
        "created_at": batch.created_at, "updated_at": batch.updated_at,
    }


@router.post("/classes", status_code=201)
def create_classroom(
    request: ClassroomCreate,
    teacher: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    classroom = Classroom(
        teacher_id=teacher.id, name=request.name.strip(), invite_code=_new_invite_code(db), status="active",
    )
    db.add(classroom); db.flush()
    operations.audit(db, teacher.id, "classroom.create", "classroom", classroom.id, detail={"name": classroom.name})
    db.commit(); db.refresh(classroom)
    return operations.classroom_payload(db, classroom)


@router.get("/classes")
def list_classrooms(
    user: User = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db),
):
    query = db.query(Classroom).filter_by(status="active")
    if user.role == "teacher":
        query = query.filter(Classroom.teacher_id == user.id)
    return [operations.classroom_payload(db, row) for row in query.order_by(Classroom.id.desc()).all()]


@router.post("/classes/join")
def join_classroom(
    request: ClassroomJoin,
    student: User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    classroom = db.query(Classroom).filter_by(invite_code=request.invite_code.upper(), status="active").first()
    if not classroom:
        raise HTTPException(status_code=404, detail="邀请码无效或已停用")
    membership = db.query(ClassMembership).filter_by(classroom_id=classroom.id, student_id=student.id).first()
    if membership:
        membership.status = "active"
    else:
        membership = ClassMembership(classroom_id=classroom.id, student_id=student.id, status="active")
        db.add(membership)
    operations.audit(db, student.id, "classroom.join", "classroom", classroom.id)
    db.commit()
    return {"classroom": operations.classroom_payload(db, classroom), "joined": True}


@router.get("/classes/{classroom_id}/students")
def list_class_students(
    classroom_id: int,
    user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    classroom = _class_or_error(db, classroom_id, user)
    rows = db.query(ClassMembership, User).join(User, User.id == ClassMembership.student_id).filter(
        ClassMembership.classroom_id == classroom.id, ClassMembership.status == "active",
    ).order_by(User.name, User.id).all()
    return [{"id": student.id, "name": student.name, "username": student.username, "joined_at": member.joined_at} for member, student in rows]


@router.get("/classes/{classroom_id}/dashboard")
def classroom_dashboard(
    classroom_id: int,
    days: int = Query(7, ge=1, le=90),
    user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    if days not in {7, 30, 90}:
        raise HTTPException(status_code=422, detail="统计区间仅支持 7、30 或 90 天")
    return operations.class_dashboard(db, _class_or_error(db, classroom_id, user), days)


@router.get("/classes/{classroom_id}/students/{student_id}/trajectory")
def student_trajectory(
    classroom_id: int, student_id: int,
    days: int = Query(30, ge=1, le=90),
    user: User = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db),
):
    classroom = _class_or_error(db, classroom_id, user)
    membership = db.query(ClassMembership).filter_by(classroom_id=classroom.id, student_id=student_id, status="active").first()
    student = db.get(User, student_id)
    if not membership or not student:
        raise HTTPException(status_code=404, detail="班级中没有该学生")
    since = utcnow() - timedelta(days=days)
    events = db.query(LearningEvent).filter(
        LearningEvent.user_id == student.id, LearningEvent.occurred_at >= since,
    ).order_by(LearningEvent.occurred_at.desc()).limit(200).all()
    wrong_rows = db.query(WrongItem, KnowledgePoint).join(KnowledgePoint, KnowledgePoint.id == WrongItem.knowledge_point_id).filter(
        WrongItem.user_id == student.id,
    ).order_by(WrongItem.updated_at.desc()).limit(50).all()
    progress = db.query(LearningProgress).filter_by(user_id=student.id).order_by(LearningProgress.updated_at.desc()).limit(50).all()
    return {
        "student": {"id": student.id, "name": student.name}, "period": {"days": days, "from": since, "to": utcnow()},
        "data_updated_at": utcnow(),
        "events": [{"id": row.id, "course_ref": row.course_ref, "section_id": row.section_id, "activity_type": row.activity_type, "correct": row.correct, "occurred_at": row.occurred_at} for row in events],
        "wrong_items": [{"id": item.id, "knowledge_key": knowledge.canonical_key, "content": knowledge.standard_content, "error_count": item.error_count, "mastery_level": item.mastery_level, "status": item.status, "updated_at": item.updated_at} for item, knowledge in wrong_rows],
        "progress": [{"course_ref": row.course_ref, "section_id": row.section_id, "completed_activities": row.completed_activities, "total_activities": row.total_activities, "status": row.status, "updated_at": row.updated_at} for row in progress],
    }


def _safe_csv(value: object) -> object:
    if isinstance(value, str) and value.startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


@router.get("/classes/{classroom_id}/dashboard.csv")
def export_classroom_dashboard(
    classroom_id: int,
    days: int = Query(7, ge=1, le=90),
    user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    if days not in {7, 30, 90}:
        raise HTTPException(status_code=422, detail="统计区间仅支持 7、30 或 90 天")
    classroom = _class_or_error(db, classroom_id, user)
    dashboard = operations.class_dashboard(db, classroom, days)
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["student_id", "name", "learning_events", "accuracy", "pronunciation_average", "assignments", "completed_assignments", "active_wrong_items"])
    for row in dashboard["students"]:
        writer.writerow([_safe_csv(row[key]) for key in ["student_id", "name", "learning_events", "accuracy", "pronunciation_average", "assignments", "completed_assignments", "active_wrong_items"]])
    operations.audit(db, user.id, "classroom.report.export", "classroom", classroom.id, detail={"days": days, "rows": len(dashboard["students"])})
    db.commit()
    return Response(
        content="\ufeff" + output.getvalue(), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="classroom-{classroom.id}-{days}d.csv"'},
    )


@router.post("/classes/{classroom_id}/assignments", status_code=201)
def create_class_assignment(
    classroom_id: int,
    request: ClassAssignmentCreate,
    user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    classroom = _class_or_error(db, classroom_id, user)
    if request.starts_at and request.due_at and request.due_at <= request.starts_at:
        raise HTTPException(status_code=422, detail="截止时间必须晚于开始时间")
    student_ids = [row.student_id for row in db.query(ClassMembership).filter_by(classroom_id=classroom.id, status="active").all()]
    batch = AssignmentBatch(
        classroom_id=classroom.id, teacher_id=classroom.teacher_id,
        title=request.title, course_ref=request.course_ref, section_id=request.section_id,
        total_activities=request.total_activities,
        starts_at=naive_utc(request.starts_at) if request.starts_at else None,
        due_at=naive_utc(request.due_at) if request.due_at else None,
        allow_late=request.allow_late, instructions=request.instructions, status="active", revision=1,
    )
    db.add(batch); db.flush()
    assignments = []
    for student_id in student_ids:
        assignment = Assignment(
            batch_id=batch.id, teacher_id=classroom.teacher_id, student_id=student_id,
            title=request.title, course_ref=request.course_ref, section_id=request.section_id,
            total_activities=request.total_activities,
            starts_at=naive_utc(request.starts_at) if request.starts_at else None,
            due_at=naive_utc(request.due_at) if request.due_at else None,
            instructions=request.instructions, status="assigned",
        )
        db.add(assignment); db.flush()
        db.add(AssignmentProgress(assignment_id=assignment.id, student_id=student_id))
        assignments.append(assignment.id)
    operations.audit(db, user.id, "assignment_batch.create", "assignment_batch", batch.id, detail={"classroom_id": classroom.id, "assignment_ids": assignments, "student_count": len(student_ids), "title": request.title})
    db.commit()
    return {"classroom_id": classroom.id, "batch": _batch_payload(db, batch), "created": len(assignments), "assignment_ids": assignments}


@router.get("/classes/{classroom_id}/assignment-batches")
def list_assignment_batches(
    classroom_id: int, user: User = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db),
):
    classroom = _class_or_error(db, classroom_id, user)
    rows = db.query(AssignmentBatch).filter_by(classroom_id=classroom.id).order_by(AssignmentBatch.id.desc()).all()
    return [_batch_payload(db, row) for row in rows]


@router.patch("/assignment-batches/{batch_id}")
def update_assignment_batch(
    batch_id: int, request: AssignmentBatchPatch,
    user: User = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db),
):
    batch = db.get(AssignmentBatch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="作业批次不存在")
    _class_or_error(db, batch.classroom_id, user)
    if batch.status != "active":
        raise HTTPException(status_code=409, detail="已归档批次不可修改")
    if batch.revision != request.revision:
        raise HTTPException(status_code=409, detail="作业批次已被其他操作更新，请刷新后重试")
    values = request.model_dump(exclude_unset=True, exclude={"revision"})
    starts_at = values.get("starts_at", batch.starts_at)
    due_at = values.get("due_at", batch.due_at)
    if starts_at and due_at and due_at <= starts_at:
        raise HTTPException(status_code=422, detail="截止时间必须晚于开始时间")
    normalized = {key: naive_utc(value) if key in {"starts_at", "due_at"} and value else value for key, value in values.items()}
    for key, value in normalized.items():
        setattr(batch, key, value)
    batch.revision += 1
    updated = 0; preserved = 0
    for assignment in db.query(Assignment).filter_by(batch_id=batch.id).all():
        progress = db.query(AssignmentProgress).filter_by(assignment_id=assignment.id, student_id=assignment.student_id).first()
        if progress and progress.status == "completed":
            preserved += 1
            continue
        for key, value in normalized.items():
            if hasattr(assignment, key): setattr(assignment, key, value)
        updated += 1
    operations.audit(db, user.id, "assignment_batch.update", "assignment_batch", batch.id, detail={"fields": sorted(normalized), "updated_assignments": updated, "preserved_submissions": preserved, "revision": batch.revision})
    db.commit(); db.refresh(batch)
    return {"batch": _batch_payload(db, batch), "updated_assignments": updated, "preserved_submissions": preserved}


@router.post("/assignment-batches/{batch_id}/archive")
def archive_assignment_batch(
    batch_id: int, user: User = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db),
):
    batch = db.get(AssignmentBatch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="作业批次不存在")
    _class_or_error(db, batch.classroom_id, user)
    batch.status = "archived"; batch.revision += 1
    for assignment in db.query(Assignment).filter_by(batch_id=batch.id, status="assigned").all():
        assignment.status = "archived"
    operations.audit(db, user.id, "assignment_batch.archive", "assignment_batch", batch.id)
    db.commit(); db.refresh(batch)
    return _batch_payload(db, batch)


def _preference(db: Session, user_id: int) -> NotificationPreference:
    preference = db.get(NotificationPreference, user_id)
    if not preference:
        preference = NotificationPreference(user_id=user_id)
        db.add(preference); db.flush()
    return preference


def _preference_payload(row: NotificationPreference) -> dict:
    return {key: getattr(row, key) for key in ["weekly_report", "assignment_due", "review_due", "streak_reminder", "updated_at"]}


@router.get("/me/notification-preferences")
def notification_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _preference(db, user.id); db.commit(); db.refresh(row)
    return _preference_payload(row)


@router.put("/me/notification-preferences")
def update_notification_preferences(
    request: NotificationPreferenceUpdate,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    row = _preference(db, user.id)
    for key, value in request.model_dump().items():
        setattr(row, key, value)
    operations.audit(db, user.id, "notification_preferences.update", "user", user.id, detail=request.model_dump())
    db.commit(); db.refresh(row)
    return _preference_payload(row)


@router.get("/me/notifications")
def my_notifications(
    unread_only: bool = False, limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    query = db.query(Notification).filter_by(user_id=user.id, status="delivered")
    if unread_only:
        query = query.filter(Notification.read_at.is_(None))
    return [notification_service.payload(row) for row in query.order_by(Notification.id.desc()).limit(limit).all()]


@router.post("/me/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    row = db.get(Notification, notification_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="通知不存在")
    if row.read_at is None:
        row.read_at = utcnow()
    db.commit(); db.refresh(row)
    return notification_service.payload(row)


@router.post("/admin/notifications/dispatch")
def dispatch_notifications(admin: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    result = notification_service.dispatch_due(db)
    operations.audit(db, admin.id, "notifications.dispatch", "notification", "due", detail=result)
    db.commit()
    return result


def _outbox_payload(row: NotificationOutbox) -> dict:
    return {
        "id": row.id, "notification_id": row.notification_id, "channel": row.channel,
        "status": row.status, "attempt_count": row.attempt_count, "max_attempts": row.max_attempts,
        "next_attempt_at": row.next_attempt_at, "last_error": row.last_error,
        "provider_message_id": row.provider_message_id, "sent_at": row.sent_at,
        "created_at": row.created_at, "updated_at": row.updated_at,
    }


@router.get("/admin/notifications/outbox")
def notification_outbox(
    limit: int = Query(50, ge=1, le=200),
    _: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    summary = {
        status: db.query(NotificationOutbox).filter_by(status=status).count()
        for status in ["pending", "failed", "sent", "dead"]
    }
    rows = db.query(NotificationOutbox).order_by(NotificationOutbox.id.desc()).limit(limit).all()
    return {"summary": summary, "items": [_outbox_payload(row) for row in rows]}


@router.post("/admin/notifications/outbox/process")
def process_notification_outbox(
    limit: int = Query(100, ge=1, le=500),
    admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    result = notification_delivery.process_outbox(db, limit=limit)
    operations.audit(db, admin.id, "notifications.outbox.process", "notification_outbox", "batch", detail=result)
    db.commit()
    return result


@router.post("/admin/notifications/outbox/{outbox_id}/retry")
def retry_notification_outbox(
    outbox_id: int,
    admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    row = db.get(NotificationOutbox, outbox_id)
    if not row:
        raise HTTPException(status_code=404, detail="通知发送任务不存在")
    notification_delivery.retry_outbox(db, row)
    operations.audit(db, admin.id, "notifications.outbox.retry", "notification_outbox", row.id)
    db.commit(); db.refresh(row)
    return _outbox_payload(row)


@router.get("/parent/children")
def parent_children(parent: User = Depends(require_roles("parent")), db: Session = Depends(get_db)):
    children = db.query(User).filter_by(parent_id=parent.id, role="student", is_active=True).order_by(User.name).all()
    return [{"id": child.id, "name": child.name, "username": child.username} for child in children]


@router.get("/parent/weekly-report")
def parent_weekly_report(
    student_id: int,
    parent: User = Depends(require_roles("parent")), db: Session = Depends(get_db),
):
    student = db.get(User, student_id)
    if not student or student.role != "student" or student.parent_id != parent.id:
        raise HTTPException(status_code=404, detail="未找到已绑定的孩子")
    return operations.weekly_report(db, student)


@router.post("/admin/points-adjustments", status_code=201)
def adjust_points(
    request: PointsAdjustmentRequest,
    admin: User = Depends(require_roles("admin")), db: Session = Depends(get_db),
):
    if request.amount == 0:
        raise HTTPException(status_code=422, detail="调整积分不能为 0")
    student = db.get(User, request.student_id)
    if not student or student.role != "student":
        raise HTTPException(status_code=422, detail="学生账号不存在")
    try:
        transaction, duplicate = economy.post_transaction(
            db, student.id, amount=request.amount, transaction_type="adjustment",
            reason="manual_adjustment", source_id=str(admin.id),
            idempotency_key=f"manual:{admin.id}:{request.idempotency_key}",
            detail={"reason": request.reason, "operator_id": admin.id},
        )
        if not duplicate:
            operations.audit(db, admin.id, "points.adjust", "user", student.id, reason=request.reason, detail={"amount": request.amount, "transaction_id": transaction.id})
        db.commit(); db.refresh(transaction)
    except ValueError as error:
        db.rollback(); raise HTTPException(status_code=409, detail=str(error)) from error
    return {"duplicate": duplicate, "transaction": economy.transaction_payload(transaction)}


@router.get("/admin/audit-logs")
def audit_logs(
    action: str | None = Query(default=None, max_length=64),
    limit: int = Query(100, ge=1, le=500),
    _: User = Depends(require_roles("admin")), db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    rows = query.order_by(AuditLog.id.desc()).limit(limit).all()
    return [{
        "id": row.id, "actor_id": row.actor_id, "action": row.action,
        "target_type": row.target_type, "target_id": row.target_id,
        "reason": row.reason, "detail": json.loads(row.detail_json) if row.detail_json else None,
        "created_at": row.created_at,
    } for row in rows]
