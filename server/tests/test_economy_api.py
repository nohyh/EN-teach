"""Stage 3 points ledger, store, inventory and growth contract tests."""
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import hash_password
from app.db.database import Base, get_db
from app.db.models import BadgeDefinition, PointsAccount, PointsTransaction, RewardRule, StoreItem, User
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
            RewardRule(code="activity_correct", event_type="learning", points=2, daily_limit=4, status="active", description="correct"),
            RewardRule(code="lesson_complete", event_type="learning", points=20, daily_limit=100, status="active", description="complete"),
            RewardRule(code="first_perfect", event_type="learning", points=10, daily_limit=50, status="active", description="perfect"),
            RewardRule(code="badge_unlock", event_type="growth", points=5, daily_limit=50, status="active", description="badge"),
            BadgeDefinition(code="first-step", name="First", description="First event", icon="🌱", criteria_type="learning_events", threshold=1, status="active"),
            StoreItem(id=1, slug="mint", name="Mint", category="skin", price=15, status="active", preview="mint"),
            StoreItem(id=2, slug="sunset", name="Sunset", category="skin", price=12, status="active", preview="sunset"),
            StoreItem(id=3, slug="hidden", name="Hidden", category="skin", price=1, status="inactive"),
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


def event(key: str, activity_index: int, completed: int, total: int = 3):
    return {
        "idempotency_key": key, "course_ref": "mock:0", "client_progress_key": "0:0",
        "section_id": "hello", "activity_index": activity_index, "activity_type": "recall",
        "prompt": "Say hello", "correct_answer": "hello", "user_answer": "hello", "correct": True,
        "completed_activities": completed, "total_activities": total,
    }


def test_rewards_are_auditable_capped_and_idempotent():
    client, sessions = setup_client()
    student = token(client, "student", "StudentPass123!")
    student2 = token(client, "student2", "StudentPass123!")
    first = client.post("/api/v1/me/learning-events", json=event("economy-event-0001", 0, 1), headers=student)
    assert first.status_code == 201
    duplicate = client.post("/api/v1/me/learning-events", json=event("economy-event-0001", 0, 1), headers=student)
    assert duplicate.json()["duplicate"] is True
    client.post("/api/v1/me/learning-events", json=event("economy-event-0002", 1, 2), headers=student)
    client.post("/api/v1/me/learning-events", json=event("economy-event-0003", 2, 3), headers=student)

    account = client.get("/api/v1/me/points", headers=student).json()
    # Correct-answer rewards stop at 4; completion 20, perfect 10, first badge 5.
    assert account["balance"] == 39
    ledger = client.get("/api/v1/me/points/transactions", headers=student).json()
    assert sum(row["amount"] for row in ledger) == account["balance"]
    assert len([row for row in ledger if row["reason"] == "activity_correct"]) == 2
    growth = client.get("/api/v1/me/growth", headers=student)
    assert growth.status_code == 200
    assert growth.json()["badges"] == [{
        "code": "first-step", "name": "First", "description": "First event", "icon": "🌱",
        "awarded_at": growth.json()["badges"][0]["awarded_at"],
    }]
    with sessions() as db:
        assert db.query(PointsAccount).one().version == len(ledger)
        assert db.query(PointsTransaction).count() == len(ledger)

    # Stable reward keys are user-scoped: another learner can earn the same badge/rule.
    other_event = event("economy-other-0001", 0, 1)
    other_event["client_progress_key"] = "other:0"
    assert client.post("/api/v1/me/learning-events", json=other_event, headers=student2).status_code == 201
    assert client.get("/api/v1/me/points", headers=student2).json()["balance"] == 7


def test_purchase_is_atomic_idempotent_and_equipment_is_user_scoped():
    client, sessions = setup_client()
    student = token(client, "student", "StudentPass123!")
    student2 = token(client, "student2", "StudentPass123!")
    with sessions() as db:
        student_id = db.query(User).filter_by(username="student").one().id
        student2_id = db.query(User).filter_by(username="student2").one().id
        db.add_all([PointsAccount(user_id=student_id, balance=30, version=0), PointsAccount(user_id=student2_id, balance=30, version=0)]); db.commit()

    items = client.get("/api/v1/store/items", headers=student).json()
    assert [row["id"] for row in items] == [2, 1]
    bought = client.post("/api/v1/store/purchases", json={"item_id": 1, "idempotency_key": "purchase-mint-0001"}, headers=student)
    assert bought.status_code == 201 and bought.json()["balance"] == 15
    repeat = client.post("/api/v1/store/purchases", json={"item_id": 1, "idempotency_key": "purchase-mint-0001"}, headers=student)
    assert repeat.json()["duplicate"] is True and repeat.json()["balance"] == 15
    assert client.post("/api/v1/store/purchases", json={"item_id": 2, "idempotency_key": "purchase-mint-0001"}, headers=student2).status_code == 201
    second = client.post("/api/v1/store/purchases", json={"item_id": 2, "idempotency_key": "purchase-sunset-01"}, headers=student)
    assert second.status_code == 201 and second.json()["balance"] == 3
    insufficient = client.post("/api/v1/store/purchases", json={"item_id": 3, "idempotency_key": "purchase-hidden-01"}, headers=student)
    assert insufficient.status_code == 409

    assert client.put("/api/v1/me/assets/1/equip", headers=student).status_code == 200
    assert client.put("/api/v1/me/assets/2/equip", headers=student).status_code == 200
    assets = client.get("/api/v1/me/assets", headers=student).json()
    assert [row["id"] for row in assets if row["equipped"]] == [2]
    assert client.put("/api/v1/me/assets/1/equip", headers=student2).status_code == 409


def test_admin_can_publish_store_item_without_app_release_and_auth_is_required():
    client, _ = setup_client()
    admin = token(client, "admin", "AdminPass123!")
    student = token(client, "student", "StudentPass123!")
    body = {"slug": "ocean", "name": "Ocean", "category": "background", "price": 9, "status": "active", "preview": "ocean"}
    assert client.post("/api/v1/store/items", json=body, headers=student).status_code == 403
    created = client.post("/api/v1/store/items", json=body, headers=admin)
    assert created.status_code == 201
    assert any(item["slug"] == "ocean" for item in client.get("/api/v1/store/items", headers=student).json())
    assert client.get("/api/v1/me/points").status_code == 401
