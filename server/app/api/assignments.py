"""Teacher-to-student assignments, progress and feedback APIs."""
import json
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_roles
from app.db.database import get_db
from app.db.models import Assignment, AssignmentFeedback, AssignmentProgress, ClassMembership, Classroom, Notification, User, utcnow
from app.services import operations
from app.services.learning_loop import naive_utc


router = APIRouter(prefix="/api/v1/assignments", tags=["assignments"])


class AssignmentCreate(BaseModel):
    student_id: int
    title: str = Field(min_length=1, max_length=255)
    course_ref: str = Field(min_length=1, max_length=128)
    section_id: str = Field(min_length=1, max_length=96)
    total_activities: int = Field(ge=1, le=5000)
    starts_at: datetime | None = None
    due_at: datetime | None = None
    instructions: str = Field(default="", max_length=2000)


class AssignmentPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    starts_at: datetime | None = None
    due_at: datetime | None = None
    instructions: str | None = Field(default=None, max_length=2000)


class AssignmentFeedbackUpsert(BaseModel):
    revision: int = Field(default=0, ge=0)
    comment: str = Field(min_length=2, max_length=2000)
    encouragement_tag: Literal["great_progress", "keep_practicing", "careful_work", "confident_speaking"] | None = None

    @field_validator("comment")
    @classmethod
    def non_blank_comment(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("评语至少需要 2 个字")
        return value


class AssignmentFeedbackResponse(BaseModel):
    response: str = Field(min_length=1, max_length=500)

    @field_validator("response")
    @classmethod
    def non_blank_response(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("回复不能为空")
        return value


def _feedback_payload(db: Session, assignment: Assignment) -> dict | None:
    feedback = db.query(AssignmentFeedback).filter_by(assignment_id=assignment.id).first()
    if not feedback:
        return None
    teacher = db.get(User, feedback.teacher_id)
    return {
        "id": feedback.id, "comment": feedback.comment,
        "encouragement_tag": feedback.encouragement_tag, "revision": feedback.revision,
        "teacher": {"id": feedback.teacher_id, "name": teacher.name if teacher else "老师"},
        "student_response": feedback.student_response, "responded_at": feedback.responded_at,
        "created_at": feedback.created_at, "updated_at": feedback.updated_at,
    }


def _payload(db: Session, assignment: Assignment) -> dict:
    progress = db.query(AssignmentProgress).filter_by(assignment_id=assignment.id, student_id=assignment.student_id).first()
    return {
        "id": assignment.id, "batch_id": assignment.batch_id, "teacher_id": assignment.teacher_id, "student_id": assignment.student_id,
        "title": assignment.title, "course_ref": assignment.course_ref, "section_id": assignment.section_id,
        "total_activities": assignment.total_activities, "starts_at": assignment.starts_at,
        "due_at": assignment.due_at, "status": assignment.status, "instructions": assignment.instructions or "",
        "feedback": _feedback_payload(db, assignment),
        "progress": {"completed_activities": progress.completed_activities, "status": progress.status, "completed_at": progress.completed_at} if progress else {"completed_activities": 0, "status": "not_started", "completed_at": None},
    }


@router.post("", status_code=201)
def create_assignment(
    request: AssignmentCreate,
    teacher: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    student = db.get(User, request.student_id)
    if not student or student.role != "student" or not student.is_active:
        raise HTTPException(status_code=422, detail="学生账号不存在或不可用")
    if teacher.role == "teacher":
        can_manage = db.query(ClassMembership).join(Classroom, Classroom.id == ClassMembership.classroom_id).filter(
            Classroom.teacher_id == teacher.id,
            Classroom.status == "active",
            ClassMembership.student_id == student.id,
            ClassMembership.status == "active",
        ).first()
        if not can_manage:
            raise HTTPException(status_code=403, detail="只能给自己班级中的学生布置作业")
    if request.starts_at and request.due_at and request.due_at <= request.starts_at:
        raise HTTPException(status_code=422, detail="截止时间必须晚于开始时间")
    values = request.model_dump()
    values["starts_at"] = naive_utc(request.starts_at) if request.starts_at else None
    values["due_at"] = naive_utc(request.due_at) if request.due_at else None
    assignment = Assignment(teacher_id=teacher.id, status="assigned", **values)
    db.add(assignment); db.flush()
    db.add(AssignmentProgress(assignment_id=assignment.id, student_id=student.id))
    operations.audit(db, teacher.id, "assignment.create", "assignment", assignment.id, detail={"student_id": student.id, "title": assignment.title})
    db.commit(); db.refresh(assignment)
    return _payload(db, assignment)


@router.get("")
def list_assignments(
    status: Literal["assigned", "archived"] | None = None,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    query = db.query(Assignment)
    if user.role == "student": query = query.filter(Assignment.student_id == user.id)
    elif user.role == "teacher": query = query.filter(Assignment.teacher_id == user.id)
    elif user.role != "admin": raise HTTPException(status_code=403, detail="没有查看作业的权限")
    if status: query = query.filter(Assignment.status == status)
    return [_payload(db, row) for row in query.order_by(Assignment.due_at, Assignment.id.desc()).all()]


@router.post("/{assignment_id}/archive")
def archive_assignment(
    assignment_id: int, user: User = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db),
):
    assignment = db.get(Assignment, assignment_id)
    if not assignment or user.role != "admin" and assignment.teacher_id != user.id:
        raise HTTPException(status_code=404, detail="作业不存在")
    assignment.status = "archived"
    operations.audit(db, user.id, "assignment.archive", "assignment", assignment.id)
    db.commit(); db.refresh(assignment)
    return _payload(db, assignment)


@router.patch("/{assignment_id}")
def update_assignment(
    assignment_id: int, request: AssignmentPatch,
    user: User = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db),
):
    assignment = db.get(Assignment, assignment_id)
    if not assignment or user.role != "admin" and assignment.teacher_id != user.id:
        raise HTTPException(status_code=404, detail="作业不存在")
    values = request.model_dump(exclude_unset=True)
    starts_at = values.get("starts_at", assignment.starts_at)
    due_at = values.get("due_at", assignment.due_at)
    if starts_at and due_at and due_at <= starts_at:
        raise HTTPException(status_code=422, detail="截止时间必须晚于开始时间")
    for key, value in values.items():
        setattr(assignment, key, naive_utc(value) if key in {"starts_at", "due_at"} and value else value)
    # AssignmentProgress is intentionally untouched: edits never rewrite learner submissions.
    operations.audit(db, user.id, "assignment.update", "assignment", assignment.id, detail={"fields": sorted(values)})
    db.commit(); db.refresh(assignment)
    return _payload(db, assignment)


@router.put("/{assignment_id}/feedback")
def upsert_assignment_feedback(
    assignment_id: int,
    request: AssignmentFeedbackUpsert,
    user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    assignment = db.get(Assignment, assignment_id)
    if not assignment or user.role != "admin" and assignment.teacher_id != user.id:
        raise HTTPException(status_code=404, detail="作业不存在")
    feedback = db.query(AssignmentFeedback).filter_by(assignment_id=assignment.id).with_for_update().first()
    if feedback:
        if request.revision != feedback.revision:
            raise HTTPException(status_code=409, detail="评语已被其他操作更新，请刷新后重试")
        feedback.comment = request.comment.strip()
        feedback.encouragement_tag = request.encouragement_tag
        feedback.revision += 1
        feedback.updated_at = utcnow()
    else:
        if request.revision != 0:
            raise HTTPException(status_code=409, detail="评语版本不匹配，请刷新后重试")
        feedback = AssignmentFeedback(
            assignment_id=assignment.id, teacher_id=user.id, student_id=assignment.student_id,
            comment=request.comment.strip(), encouragement_tag=request.encouragement_tag, revision=1,
        )
        db.add(feedback)
    db.flush()
    notification = Notification(
        user_id=assignment.student_id, type="teacher_feedback", title=f"老师点评了《{assignment.title}》",
        body=feedback.comment, channel="in_app", status="delivered",
        dedupe_key=f"assignment-feedback:{assignment.id}:{feedback.revision}",
        detail_json=json.dumps({"assignment_id": assignment.id, "feedback_id": feedback.id, "revision": feedback.revision}),
    )
    db.add(notification)
    operations.audit(
        db, user.id, "assignment.feedback.update", "assignment", assignment.id,
        detail={"feedback_id": feedback.id, "revision": feedback.revision, "student_id": assignment.student_id},
    )
    db.commit(); db.refresh(assignment)
    return _payload(db, assignment)


@router.post("/{assignment_id}/feedback/response")
def respond_to_assignment_feedback(
    assignment_id: int,
    request: AssignmentFeedbackResponse,
    student: User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    assignment = db.get(Assignment, assignment_id)
    if not assignment or assignment.student_id != student.id:
        raise HTTPException(status_code=404, detail="作业不存在")
    feedback = db.query(AssignmentFeedback).filter_by(assignment_id=assignment.id).with_for_update().first()
    if not feedback:
        raise HTTPException(status_code=404, detail="这份作业还没有老师评语")
    if feedback.responded_at:
        raise HTTPException(status_code=409, detail="已经回复过这条评语")
    feedback.student_response = request.response.strip()
    feedback.responded_at = utcnow()
    db.add(Notification(
        user_id=assignment.teacher_id, type="student_feedback_response", title=f"{student.name} 回复了作业评语",
        body=feedback.student_response, channel="in_app", status="delivered",
        dedupe_key=f"assignment-feedback-response:{feedback.id}",
        detail_json=json.dumps({"assignment_id": assignment.id, "feedback_id": feedback.id}),
    ))
    operations.audit(
        db, student.id, "assignment.feedback.respond", "assignment", assignment.id,
        detail={"feedback_id": feedback.id, "teacher_id": assignment.teacher_id},
    )
    db.commit(); db.refresh(assignment)
    return _payload(db, assignment)
