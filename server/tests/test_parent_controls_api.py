"""Parent learning policy authorization, feature gates and usage accounting."""
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import hash_password
from app.db.database import Base, get_db
from app.db.models import AuditLog, DailyLearningUsage, LearningUsageEvent, User
from app.main import create_app


def setup_client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add_all([
            User(id=10, username="parent1", password_hash=hash_password("ParentPass123!"), role="parent", name="Parent One"),
            User(id=11, username="parent2", password_hash=hash_password("ParentPass123!"), role="parent", name="Parent Two"),
            User(id=20, username="student1", password_hash=hash_password("StudentPass123!"), role="student", name="Student One", parent_id=10),
        ])
        db.commit()
    app = create_app()

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    return TestClient(app), sessions


def token(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_parent_policy_binding_feature_gates_and_audit():
    client, sessions = setup_client()
    parent = token(client, "parent1", "ParentPass123!")
    other_parent = token(client, "parent2", "ParentPass123!")
    student = token(client, "student1", "StudentPass123!")

    defaults = client.get("/api/v1/parent/children/20/learning-policy", headers=parent)
    assert defaults.status_code == 200
    assert defaults.json()["settings"]["daily_limit_minutes"] == 30
    assert client.get("/api/v1/parent/children/20/learning-policy", headers=other_parent).status_code == 404

    updated = client.put("/api/v1/parent/children/20/learning-policy", headers=parent, json={
        "learning_enabled": True,
        "daily_limit_minutes": 5,
        "allowed_start": "00:00",
        "allowed_end": "00:00",
        "timezone": "Asia/Shanghai",
        "voice_enabled": False,
        "ai_enabled": False,
    })
    assert updated.status_code == 200
    assert updated.json()["settings"]["voice_enabled"] is False
    assert client.get("/api/v1/me/learning-policy", headers=parent).status_code == 403

    ai = client.post("/api/v1/ai/chat", headers=student, json={"messages": [{"role": "user", "content": "Hello"}]})
    assert ai.status_code == 403 and "AI" in ai.json()["detail"]
    tts = client.get("/api/v1/tts/synthesize?text=hello", headers=student)
    assert tts.status_code == 403 and "语音" in tts.json()["detail"]
    speech = client.post(
        "/api/v1/speech/transcribe", headers=student,
        files={"audio": ("speech.pcm", b"\x00\x00", "application/octet-stream")},
        data={"fmt": "pcm", "sample_rate": "16000"},
    )
    assert speech.status_code == 403 and "语音" in speech.json()["detail"]
    with sessions() as db:
        assert db.query(AuditLog).filter_by(action="learning_policy.update", target_id="20").count() == 1


def test_usage_heartbeat_is_idempotent_and_blocks_learning_at_limit():
    client, sessions = setup_client()
    parent = token(client, "parent1", "ParentPass123!")
    student = token(client, "student1", "StudentPass123!")
    policy = {
        "learning_enabled": True, "daily_limit_minutes": 5,
        "allowed_start": "00:00", "allowed_end": "00:00", "timezone": "Asia/Shanghai",
        "voice_enabled": True, "ai_enabled": True,
    }
    assert client.put("/api/v1/parent/children/20/learning-policy", headers=parent, json=policy).status_code == 200

    first = client.post("/api/v1/me/usage-heartbeats", headers=student, json={
        "idempotency_key": "usage-test-0001", "active_seconds": 120,
    })
    assert first.status_code == 200 and first.json()["recorded_seconds"] == 120
    duplicate = client.post("/api/v1/me/usage-heartbeats", headers=student, json={
        "idempotency_key": "usage-test-0001", "active_seconds": 120,
    })
    assert duplicate.status_code == 200 and duplicate.json()["duplicate"] is True
    final = client.post("/api/v1/me/usage-heartbeats", headers=student, json={
        "idempotency_key": "usage-test-0002", "active_seconds": 300,
    })
    assert final.status_code == 200
    assert final.json()["recorded_seconds"] == 180
    assert final.json()["access"]["reason"] == "daily_limit_reached"

    blocked = client.post("/api/v1/me/learning-events", headers=student, json={
        "idempotency_key": "policy-event-0001", "course_ref": "mock:0",
        "client_progress_key": "policy:0", "section_id": "hello", "activity_index": 0,
        "activity_type": "recall", "prompt": "Hello", "correct": True,
        "completed_activities": 1, "total_activities": 1,
    })
    assert blocked.status_code == 403 and "上限" in blocked.json()["detail"]
    with sessions() as db:
        assert db.query(LearningUsageEvent).count() == 2
        assert db.query(DailyLearningUsage).one().active_seconds == 300
