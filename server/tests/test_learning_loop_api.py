"""Stage 2 cloud progress, wrong-book, review and assignment contract tests."""
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import hash_password
from app.db.database import Base, get_db
from app.db.models import AssignmentProgress, User, WrongItem, utcnow
from app.main import create_app


def setup_client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add_all([
            User(username="admin", password_hash=hash_password("AdminPass123!"), role="admin", name="Admin"),
            User(username="student", password_hash=hash_password("StudentPass123!"), role="student", name="Student"),
            User(username="student2", password_hash=hash_password("StudentPass123!"), role="student", name="Student 2"),
        ]); db.commit()
    app = create_app()
    def override_db():
        with sessions() as db: yield db
    app.dependency_overrides[get_db] = override_db
    return TestClient(app), sessions


def token(client, username, password):
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def event(key: str, *, correct=False, activity_index=0, completed=1):
    return {
        "idempotency_key": key, "course_ref": "mock:0", "client_progress_key": "0:0",
        "section_id": "hello", "activity_index": activity_index, "activity_type": "recall",
        "knowledge_key": "hello-word", "prompt": "你好用英语怎么说？", "correct_answer": "hello",
        "user_answer": "hi" if not correct else "hello", "correct": correct,
        "completed_activities": completed, "total_activities": 3,
    }


def test_learning_wrong_book_spaced_review_and_assignment_flow():
    client, sessions = setup_client()
    student = token(client, "student", "StudentPass123!")
    admin = token(client, "admin", "AdminPass123!")
    student_two = token(client, "student2", "StudentPass123!")

    first = client.post("/api/v1/me/learning-events", json=event("learn-event-0001"), headers=student)
    assert first.status_code == 201
    assert first.json()["progress"]["completed_activities"] == 1
    duplicate = client.post("/api/v1/me/learning-events", json=event("learn-event-0001"), headers=student)
    assert duplicate.json()["duplicate"] is True
    assert client.post("/api/v1/me/learning-events", json=event("learn-event-0001"), headers=student_two).status_code == 409

    second = client.post("/api/v1/me/learning-events", json=event("learn-event-0002", activity_index=1, completed=2), headers=student)
    assert second.status_code == 201
    wrong = client.get("/api/v1/me/wrong-items?status=active", headers=student).json()
    assert len(wrong) == 1
    assert wrong[0]["error_count"] == 2
    wrong_id = wrong[0]["id"]

    with sessions() as db:
        item = db.get(WrongItem, wrong_id); item.next_review_at = utcnow() - timedelta(minutes=1); db.commit()
    assert len(client.get("/api/v1/me/reviews/due", headers=student).json()) == 1

    for round_number in range(1, 4):
        started = client.post("/api/v1/me/review-sessions", json={"max_items": 10}, headers=student)
        assert started.status_code == 201
        session_id = started.json()["id"]
        answer_body = {"idempotency_key": f"review-answer-{round_number:04d}", "wrong_item_id": wrong_id, "correct": True, "user_answer": "hello"}
        answered = client.post(f"/api/v1/me/review-sessions/{session_id}/answers", json=answer_body, headers=student)
        assert answered.status_code == 200
        assert answered.json()["session"]["status"] == "completed"
        repeated = client.post(f"/api/v1/me/review-sessions/{session_id}/answers", json=answer_body, headers=student)
        assert repeated.json()["duplicate"] is True
        if round_number < 3:
            with sessions() as db:
                item = db.get(WrongItem, wrong_id); item.next_review_at = utcnow() - timedelta(minutes=1); db.commit()

    mastered = client.get("/api/v1/me/wrong-items?status=mastered", headers=student).json()
    assert len(mastered) == 1
    assert mastered[0]["correct_streak"] == 3
    assert mastered[0]["mastery_level"] == 3

    with sessions() as db:
        student_id = db.query(User).filter_by(username="student").one().id
    assignment = client.post("/api/v1/assignments", json={
        "student_id": student_id, "title": "Hello review", "course_ref": "mock:0",
        "section_id": "hello", "total_activities": 3,
    }, headers=admin)
    assert assignment.status_code == 201
    completed_event = client.post("/api/v1/me/learning-events", json=event("learn-event-0003", correct=True, activity_index=2, completed=3), headers=student)
    assert completed_event.json()["progress"]["status"] == "completed"
    student_assignments = client.get("/api/v1/assignments", headers=student).json()
    assert student_assignments[0]["progress"]["status"] == "completed"
    with sessions() as db:
        assert db.query(AssignmentProgress).one().completed_activities == 3

    # A new learning mistake reactivates a previously mastered item.
    relapse = client.post("/api/v1/me/learning-events", json=event("learn-event-0004", activity_index=2, completed=3), headers=student)
    assert relapse.status_code == 201
    active = client.get("/api/v1/me/wrong-items?status=active", headers=student).json()
    assert len(active) == 1 and active[0]["correct_streak"] == 0


def test_learning_apis_require_authentication():
    client, _ = setup_client()
    assert client.get("/api/v1/me/progress").status_code == 401
    assert client.get("/api/v1/me/wrong-items").status_code == 401
    assert client.get("/api/v1/assignments").status_code == 401
