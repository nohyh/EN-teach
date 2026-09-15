"""教材审核发布流水线 API 测试。"""
import json

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import content as content_api
from app.core.security import hash_password
from app.db.database import Base, get_db
from app.db.models import CourseDraft, User
from app.main import create_app


COURSE_CONTENT = {
    "title": "Fruit English",
    "intro": "Learn fruit.",
    "sections": [{
        "id": "lesson-1",
        "title": "Apple",
        "activities": [{
            "type": "word",
            "word": "apple",
            "meaning": "苹果",
            "example": "I like apples.",
            "exampleMeaning": "我喜欢苹果。",
            "message": "一起学习 apple。",
        }],
    }],
}


def _setup_client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add_all([
            User(username="admin", password_hash=hash_password("AdminPass123!"), role="admin", name="Admin"),
            User(username="student", password_hash=hash_password("StudentPass123!"), role="student", name="Student"),
        ])
        db.commit()
    app = create_app()

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    return TestClient(app), sessions


def _token(client: TestClient, username: str, password: str) -> str:
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_upload_permissions_and_publish_version_workflow(monkeypatch):
    client, sessions = _setup_client()
    admin_token = _token(client, "admin", "AdminPass123!")
    student_token = _token(client, "student", "StudentPass123!")
    upload = {
        "asset_kind": "source",
        "copyright_source": "self-authored",
        "usage_scope": "classroom",
        "copyright_confirmed": "true",
    }
    files = {"file": ("fruit.json", json.dumps(COURSE_CONTENT).encode(), "application/json")}
    assert client.post(
        "/api/v1/content/assets",
        data=upload,
        files=files,
        headers={"Authorization": f"Bearer {student_token}"},
    ).status_code == 403

    spoofed_pdf = client.post(
        "/api/v1/content/assets",
        data=upload,
        files={"file": ("fake.pdf", b"this is not a pdf", "application/pdf")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert spoofed_pdf.status_code == 415

    class FakeStorage:
        def save(self, _payload, _suffix):
            return "test/fruit.json"

    monkeypatch.setattr(content_api, "get_content_storage", lambda: FakeStorage())
    monkeypatch.setattr(content_api, "parse_asset", lambda _asset_id: None)
    created_asset = client.post(
        "/api/v1/content/assets",
        data=upload,
        files=files,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert created_asset.status_code == 202
    assert created_asset.json()["status"] == "uploaded"

    with sessions() as db:
        admin = db.query(User).filter_by(username="admin").one()
        draft = CourseDraft(
            owner_id=admin.id,
            title=COURSE_CONTENT["title"],
            description=COURSE_CONTENT["intro"],
            language="en-zh",
            status="ready_for_review",
            content_json=json.dumps(COURSE_CONTENT, ensure_ascii=False),
        )
        db.add(draft)
        db.commit()
        draft_id = draft.id

    headers = {"Authorization": f"Bearer {admin_token}"}
    approved = client.post(f"/api/v1/content/drafts/{draft_id}/approve", json={"note": "checked"}, headers=headers)
    assert approved.status_code == 200
    published = client.post(f"/api/v1/content/drafts/{draft_id}/publish", headers=headers)
    assert published.status_code == 201
    course = published.json()["course"]
    assert published.json()["version"]["version_number"] == 1

    public_list = client.get("/api/v1/courses")
    assert public_list.status_code == 200
    assert public_list.json()[0]["slug"] == course["slug"]
    public_detail = client.get(f"/api/v1/courses/{course['slug']}")
    assert public_detail.json()["content"]["sections"][0]["title"] == "Apple"

    new_draft = client.post(f"/api/v1/content/courses/{course['id']}/drafts", headers=headers)
    assert new_draft.status_code == 201
    new_draft_body = new_draft.json()
    changed = {**COURSE_CONTENT, "title": "Fruit English Updated"}
    updated = client.put(
        f"/api/v1/content/drafts/{new_draft_body['id']}",
        json={"title": changed["title"], "description": "v2", "content": changed},
        headers=headers,
    )
    assert updated.status_code == 200
    assert client.post(f"/api/v1/content/drafts/{new_draft_body['id']}/validate", headers=headers).json()["valid"]
    assert client.post(f"/api/v1/content/drafts/{new_draft_body['id']}/approve", json={"note": "v2"}, headers=headers).status_code == 200
    version_two = client.post(f"/api/v1/content/drafts/{new_draft_body['id']}/publish", headers=headers)
    assert version_two.json()["version"]["version_number"] == 2

    rolled_back = client.post(f"/api/v1/content/courses/{course['id']}/versions/1/rollback", headers=headers)
    assert rolled_back.status_code == 200
    assert rolled_back.json()["version"]["version_number"] == 1
    assert client.get(f"/api/v1/courses/{course['slug']}").json()["content"]["title"] == "Fruit English"

    assert client.post(f"/api/v1/content/courses/{course['id']}/unpublish", headers=headers).status_code == 200
    assert client.get(f"/api/v1/courses/{course['slug']}").status_code == 404
