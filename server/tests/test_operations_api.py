"""Stage 4 role boundaries, classroom dashboard, parent report and audit tests."""
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import hash_password
from app.db.database import Base, get_db
from datetime import timedelta

from app.db.models import Assignment, AssignmentProgress, AuditLog, LearningEvent, NotificationOutbox, RewardRule, User, utcnow
from app.main import create_app


def setup_client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add_all([
            User(username="admin", password_hash=hash_password("AdminPass123!"), role="admin", name="Admin"),
            User(username="teacher1", password_hash=hash_password("TeacherPass123!"), role="teacher", name="Teacher One"),
            User(username="teacher2", password_hash=hash_password("TeacherPass123!"), role="teacher", name="Teacher Two"),
            User(id=10, username="parent1", password_hash=hash_password("ParentPass123!"), role="parent", name="Parent One"),
            User(id=11, username="parent2", password_hash=hash_password("ParentPass123!"), role="parent", name="Parent Two"),
            User(id=20, username="student1", password_hash=hash_password("StudentPass123!"), role="student", name="Student One", parent_id=10),
            RewardRule(code="activity_correct", event_type="learning", points=2, daily_limit=60, status="active", description="答对活动"),
        ])
        db.commit()
    app = create_app()

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    return TestClient(app), sessions


def token(client, username, password):
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_teacher_classroom_dashboard_assignment_export_and_role_boundaries():
    client, sessions = setup_client()
    teacher_one = token(client, "teacher1", "TeacherPass123!")
    teacher_two = token(client, "teacher2", "TeacherPass123!")
    student = token(client, "student1", "StudentPass123!")
    admin = token(client, "admin", "AdminPass123!")

    created = client.post("/api/v1/classes", json={"name": "一年级星星班"}, headers=teacher_one)
    assert created.status_code == 201
    classroom = created.json()
    assert classroom["student_count"] == 0
    assert client.get("/api/v1/classes", headers=teacher_two).json() == []

    joined = client.post("/api/v1/classes/join", json={"invite_code": classroom["invite_code"].lower()}, headers=student)
    assert joined.status_code == 200
    assert joined.json()["classroom"]["student_count"] == 1
    assert client.get(f"/api/v1/classes/{classroom['id']}/students", headers=teacher_one).json()[0]["id"] == 20
    assert client.get(f"/api/v1/classes/{classroom['id']}/dashboard", headers=teacher_two).status_code == 403
    assert client.post("/api/v1/assignments", json={
        "student_id": 20, "title": "越权作业", "course_ref": "mock:0",
        "section_id": "hello", "total_activities": 2,
    }, headers=teacher_two).status_code == 403

    event = client.post("/api/v1/me/learning-events", json={
        "idempotency_key": "operations-event-0001", "course_ref": "mock:0",
        "client_progress_key": "ops:0", "section_id": "hello", "activity_index": 0,
        "activity_type": "recall", "knowledge_key": "hello", "prompt": "Say hello",
        "correct_answer": "hello", "user_answer": "hello", "correct": True,
        "completed_activities": 1, "total_activities": 2,
    }, headers=student)
    assert event.status_code == 201

    assigned = client.post(f"/api/v1/classes/{classroom['id']}/assignments", json={
        "title": "班级问候练习", "course_ref": "mock:0", "section_id": "hello",
        "total_activities": 2, "instructions": "完成全部活动",
    }, headers=teacher_one)
    assert assigned.status_code == 201 and assigned.json()["created"] == 1
    assignment_id = assigned.json()["assignment_ids"][0]
    with sessions() as db:
        progress_id = db.query(AssignmentProgress).filter_by(assignment_id=assignment_id).one().id
    patched = client.patch(f"/api/v1/assignments/{assignment_id}", json={"title": "更新后的班级问候练习"}, headers=teacher_one)
    assert patched.status_code == 200 and patched.json()["title"] == "更新后的班级问候练习"
    with sessions() as db:
        assert db.query(AssignmentProgress).filter_by(assignment_id=assignment_id).one().id == progress_id
        progress = db.query(AssignmentProgress).filter_by(assignment_id=assignment_id).one()
        progress.status = "completed"; progress.completed_activities = 2; progress.completed_at = utcnow(); db.commit()
    batch_id = assigned.json()["batch"]["id"]
    batch_update = client.patch(f"/api/v1/assignment-batches/{batch_id}", json={"revision": 1, "title": "批次更新标题", "allow_late": False}, headers=teacher_one)
    assert batch_update.status_code == 200
    assert batch_update.json()["preserved_submissions"] == 1 and batch_update.json()["updated_assignments"] == 0
    assert batch_update.json()["batch"]["revision"] == 2
    assert client.patch(f"/api/v1/assignment-batches/{batch_id}", json={"revision": 1, "title": "过期修改"}, headers=teacher_one).status_code == 409
    with sessions() as db:
        assert db.get(Assignment, assignment_id).title == "更新后的班级问候练习"

    feedback = client.put(f"/api/v1/assignments/{assignment_id}/feedback", json={
        "revision": 0, "comment": "问候语掌握得很好，下一次试着说得更自然一些。", "encouragement_tag": "great_progress",
    }, headers=teacher_one)
    assert feedback.status_code == 200
    assert feedback.json()["feedback"]["revision"] == 1
    assert feedback.json()["feedback"]["teacher"]["name"] == "Teacher One"
    assert client.put(f"/api/v1/assignments/{assignment_id}/feedback", json={
        "revision": 0, "comment": "越权评语",
    }, headers=teacher_two).status_code == 404
    stale = client.put(f"/api/v1/assignments/{assignment_id}/feedback", json={
        "revision": 0, "comment": "过期版本评语",
    }, headers=teacher_one)
    assert stale.status_code == 409
    response = client.post(f"/api/v1/assignments/{assignment_id}/feedback/response", json={
        "response": "谢谢老师，我会继续练习！",
    }, headers=student)
    assert response.status_code == 200
    assert response.json()["feedback"]["student_response"] == "谢谢老师，我会继续练习！"
    assert client.post(f"/api/v1/assignments/{assignment_id}/feedback/response", json={
        "response": "重复回复",
    }, headers=student).status_code == 409
    student_assignments = client.get("/api/v1/assignments", headers=student).json()
    assert student_assignments[0]["feedback"]["encouragement_tag"] == "great_progress"
    teacher_notifications = client.get("/api/v1/me/notifications", headers=teacher_one).json()
    assert any(item["type"] == "student_feedback_response" for item in teacher_notifications)

    dashboard = client.get(f"/api/v1/classes/{classroom['id']}/dashboard?days=7", headers=teacher_one)
    assert dashboard.status_code == 200
    body = dashboard.json()
    assert body["summary"]["student_count"] == 1
    assert body["summary"]["learning_events"] == 1
    assert body["summary"]["accuracy"] == 100
    assert body["period"]["days"] == 7 and body["data_updated_at"]
    assert client.get(f"/api/v1/classes/{classroom['id']}/students/20/trajectory?days=30", headers=teacher_one).status_code == 200
    assert client.get(f"/api/v1/classes/{classroom['id']}/students/20/trajectory?days=30", headers=teacher_two).status_code == 403
    with sessions() as db:
        assert db.query(LearningEvent).filter_by(user_id=20).count() == body["summary"]["learning_events"]

    exported = client.get(f"/api/v1/classes/{classroom['id']}/dashboard.csv?days=7", headers=teacher_one)
    assert exported.status_code == 200
    assert "Student One" in exported.text
    assert client.get("/api/v1/admin/audit-logs", headers=teacher_one).status_code == 403
    logs = client.get("/api/v1/admin/audit-logs", headers=admin).json()
    assert any(row["action"] == "classroom.report.export" for row in logs)
    assert any(row["action"] == "assignment.feedback.update" for row in logs)
    assert any(row["action"] == "assignment.feedback.respond" for row in logs)


def test_parent_report_preferences_and_audited_points_adjustment():
    client, sessions = setup_client()
    parent_one = token(client, "parent1", "ParentPass123!")
    parent_two = token(client, "parent2", "ParentPass123!")
    admin = token(client, "admin", "AdminPass123!")

    children = client.get("/api/v1/parent/children", headers=parent_one)
    assert children.status_code == 200 and children.json()[0]["id"] == 20
    assert client.get("/api/v1/parent/weekly-report?student_id=20", headers=parent_one).status_code == 200
    assert client.get("/api/v1/parent/weekly-report?student_id=20", headers=parent_two).status_code == 404

    defaults = client.get("/api/v1/me/notification-preferences", headers=parent_one).json()
    assert defaults == {
        "weekly_report": True, "assignment_due": True, "review_due": True,
        "streak_reminder": False, "updated_at": defaults["updated_at"],
    }
    updated = client.put("/api/v1/me/notification-preferences", json={
        "weekly_report": True, "assignment_due": False,
        "review_due": True, "streak_reminder": False,
    }, headers=parent_one)
    assert updated.status_code == 200 and updated.json()["assignment_due"] is False

    payload = {"student_id": 20, "amount": 25, "reason": "课堂积极发言奖励", "idempotency_key": "adjustment-0001"}
    adjustment = client.post("/api/v1/admin/points-adjustments", json=payload, headers=admin)
    assert adjustment.status_code == 201
    assert adjustment.json()["transaction"]["balance_after"] == 25
    repeated = client.post("/api/v1/admin/points-adjustments", json=payload, headers=admin)
    assert repeated.status_code == 201 and repeated.json()["duplicate"] is True
    assert client.post("/api/v1/admin/points-adjustments", json={**payload, "idempotency_key": "adjustment-0002", "amount": -30}, headers=admin).status_code == 409
    assert client.get("/api/v1/admin/reward-rules", headers=parent_one).status_code == 403
    rule = client.patch("/api/v1/admin/reward-rules/activity_correct", json={"points": 3, "daily_limit": 75}, headers=admin)
    assert rule.status_code == 200 and rule.json()["points"] == 3 and rule.json()["daily_limit"] == 75
    with sessions() as db:
        db.add(Assignment(teacher_id=1, student_id=20, title="明天到期作业", course_ref="mock:0", section_id="hello", total_activities=2, due_at=utcnow() + timedelta(hours=12), status="assigned"))
        db.commit()
    dispatched = client.post("/api/v1/admin/notifications/dispatch", headers=admin)
    assert dispatched.status_code == 200 and dispatched.json()["created"] >= 2
    assert client.post("/api/v1/admin/notifications/dispatch", headers=admin).json()["created"] == 0
    assert client.get("/api/v1/admin/notifications/outbox", headers=parent_one).status_code == 403
    outbox = client.get("/api/v1/admin/notifications/outbox", headers=admin)
    assert outbox.status_code == 200 and outbox.json()["summary"]["pending"] >= 2
    processed = client.post("/api/v1/admin/notifications/outbox/process", headers=admin)
    assert processed.status_code == 200 and processed.json()["sent"] >= 2
    inbox = client.get("/api/v1/me/notifications?unread_only=true", headers=parent_one)
    assert inbox.status_code == 200 and any(item["type"] == "weekly_report" for item in inbox.json())
    notification_id = inbox.json()[0]["id"]
    assert client.post(f"/api/v1/me/notifications/{notification_id}/read", headers=parent_two).status_code == 404
    assert client.post(f"/api/v1/me/notifications/{notification_id}/read", headers=parent_one).json()["read_at"]
    with sessions() as db:
        assert db.query(AuditLog).filter_by(action="points.adjust", target_id="20").count() == 1
        assert db.query(AuditLog).filter_by(action="reward_rule.update", target_id="activity_correct").count() == 1
        assert db.query(NotificationOutbox).filter_by(status="sent", channel="mock").count() >= 2
