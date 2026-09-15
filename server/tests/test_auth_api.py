"""账号、访问令牌与刷新会话的端到端契约测试。"""
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base, get_db
from app.main import create_app


def _client() -> TestClient:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    app = create_app()

    def override_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    return TestClient(app)


def test_register_login_refresh_and_logout_flow():
    client = _client()
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "username": "Little.Lumi",
            "password": "StrongPass123!",
            "name": "小露米",
            "role": "student",
        },
    )
    assert registered.status_code == 201
    assert registered.json()["username"] == "little.lumi"
    assert "password_hash" not in registered.json()
    assert registered.headers["x-request-id"]

    duplicate = client.post(
        "/api/v1/auth/register",
        json={
            "username": "little.lumi",
            "password": "StrongPass123!",
            "name": "重复账号",
            "role": "student",
        },
    )
    assert duplicate.status_code == 409

    assert client.post(
        "/api/v1/auth/login",
        json={"username": "little.lumi", "password": "wrong-password"},
    ).status_code == 401

    logged_in = client.post(
        "/api/v1/auth/login",
        json={"username": "little.lumi", "password": "StrongPass123!"},
    )
    assert logged_in.status_code == 200
    tokens = logged_in.json()

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["name"] == "小露米"

    refreshed = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert refreshed.status_code == 200
    rotated = refreshed.json()
    assert rotated["refresh_token"] != tokens["refresh_token"]
    assert client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    ).status_code == 401

    assert client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": rotated["refresh_token"]},
    ).status_code == 204
    assert client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": rotated["refresh_token"]},
    ).status_code == 401


def test_registration_rejects_privileged_roles():
    client = _client()
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "teacher-one",
            "password": "StrongPass123!",
            "name": "老师",
            "role": "teacher",
        },
    )
    assert response.status_code == 422


def test_private_learning_records_require_login():
    client = _client()
    assert client.get("/api/v1/attempts/by-speech/example").status_code == 401
