"""Teacher dashboards, parent reports and immutable operational audit helpers."""
from __future__ import annotations

import json
from datetime import timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import (
    Assignment, AssignmentProgress, AuditLog, ClassMembership, Classroom,
    KnowledgePoint, LearningEvent, LearningProgress, SentenceAttempt, User,
    WrongItem, utcnow,
)


def audit(
    db: Session, actor_id: int, action: str, target_type: str, target_id: str | int,
    *, reason: str | None = None, detail: dict | None = None,
) -> AuditLog:
    row = AuditLog(
        actor_id=actor_id, action=action, target_type=target_type,
        target_id=str(target_id), reason=reason,
        detail_json=json.dumps(detail, ensure_ascii=False) if detail else None,
    )
    db.add(row)
    return row


def require_classroom(db: Session, classroom_id: int, user: User) -> Classroom:
    classroom = db.get(Classroom, classroom_id)
    if not classroom or classroom.status != "active":
        raise LookupError("班级不存在")
    if user.role != "admin" and classroom.teacher_id != user.id:
        raise PermissionError("没有查看该班级的权限")
    return classroom


def classroom_payload(db: Session, classroom: Classroom) -> dict:
    student_count = db.query(ClassMembership).filter_by(classroom_id=classroom.id, status="active").count()
    return {
        "id": classroom.id, "teacher_id": classroom.teacher_id, "name": classroom.name,
        "invite_code": classroom.invite_code, "status": classroom.status,
        "student_count": student_count, "created_at": classroom.created_at,
    }


def student_summary(db: Session, student: User, since, until) -> dict:
    events = db.query(LearningEvent).filter(
        LearningEvent.user_id == student.id,
        LearningEvent.occurred_at >= since,
        LearningEvent.occurred_at < until,
    )
    event_count = events.count()
    correct_count = events.filter(LearningEvent.correct.is_(True)).count()
    attempts = db.query(SentenceAttempt).filter(
        SentenceAttempt.user_id == student.id,
        SentenceAttempt.created_at >= since,
        SentenceAttempt.created_at < until,
    )
    pronunciation = attempts.with_entities(func.avg(SentenceAttempt.overall)).scalar()
    assignments = db.query(AssignmentProgress).join(Assignment, Assignment.id == AssignmentProgress.assignment_id).filter(
        AssignmentProgress.student_id == student.id,
        Assignment.created_at >= since,
        Assignment.created_at < until,
    )
    assignment_count = assignments.count()
    assignment_completed = assignments.filter(AssignmentProgress.status == "completed").count()
    wrong_active = db.query(WrongItem).filter_by(user_id=student.id, status="active").count()
    mastered = db.query(WrongItem).filter_by(user_id=student.id, status="mastered").count()
    return {
        "student_id": student.id, "name": student.name,
        "learning_events": event_count, "correct_events": correct_count,
        "accuracy": round(correct_count * 100 / event_count, 1) if event_count else 0,
        "pronunciation_average": round(float(pronunciation), 1) if pronunciation is not None else None,
        "assignments": assignment_count, "completed_assignments": assignment_completed,
        "assignment_completion_rate": round(assignment_completed * 100 / assignment_count, 1) if assignment_count else 0,
        "active_wrong_items": wrong_active, "mastered_wrong_items": mastered,
    }


def class_dashboard(db: Session, classroom: Classroom, days: int) -> dict:
    until = utcnow() + timedelta(microseconds=1)
    since = until - timedelta(days=days)
    memberships = db.query(ClassMembership).filter_by(classroom_id=classroom.id, status="active").all()
    students = [db.get(User, row.student_id) for row in memberships]
    student_rows = [student_summary(db, student, since, until) for student in students if student]
    ids = [row["student_id"] for row in student_rows]
    weak_rows = []
    if ids:
        grouped = db.query(
            KnowledgePoint.canonical_key,
            KnowledgePoint.standard_content,
            func.sum(WrongItem.error_count).label("errors"),
            func.count(WrongItem.id).label("students"),
        ).join(WrongItem, WrongItem.knowledge_point_id == KnowledgePoint.id).filter(
            WrongItem.user_id.in_(ids), WrongItem.status == "active",
        ).group_by(KnowledgePoint.canonical_key, KnowledgePoint.standard_content).order_by(
            func.sum(WrongItem.error_count).desc(), KnowledgePoint.canonical_key,
        ).limit(10).all()
        weak_rows = [
            {"knowledge_key": key, "content": content, "error_count": int(errors), "student_count": int(count)}
            for key, content, errors, count in grouped
        ]
    total_events = sum(row["learning_events"] for row in student_rows)
    total_correct = sum(row["correct_events"] for row in student_rows)
    total_assignments = sum(row["assignments"] for row in student_rows)
    total_completed = sum(row["completed_assignments"] for row in student_rows)
    return {
        "classroom": classroom_payload(db, classroom),
        "period": {"days": days, "from": since, "to": until},
        "data_updated_at": utcnow(),
        "summary": {
            "student_count": len(student_rows), "learning_events": total_events,
            "accuracy": round(total_correct * 100 / total_events, 1) if total_events else 0,
            "assignment_completion_rate": round(total_completed * 100 / total_assignments, 1) if total_assignments else 0,
        },
        "students": student_rows,
        "weak_knowledge_points": weak_rows,
    }


def weekly_report(db: Session, student: User) -> dict:
    until = utcnow() + timedelta(microseconds=1)
    since = until - timedelta(days=7)
    summary = student_summary(db, student, since, until)
    recent_progress = db.query(LearningProgress).filter(
        LearningProgress.user_id == student.id,
        LearningProgress.updated_at >= since,
        LearningProgress.updated_at < until,
    ).order_by(LearningProgress.updated_at.desc()).limit(20).all()
    due_reviews = db.query(WrongItem).filter(
        WrongItem.user_id == student.id,
        WrongItem.status == "active",
        WrongItem.next_review_at <= until,
    ).count()
    return {
        "student": {"id": student.id, "name": student.name},
        "period": {"from": since, "to": until}, "data_updated_at": utcnow(),
        "summary": summary, "due_reviews": due_reviews,
        "recent_courses": [
            {"course_ref": row.course_ref, "section_id": row.section_id, "status": row.status,
             "completed_activities": row.completed_activities, "total_activities": row.total_activities}
            for row in recent_progress
        ],
    }
