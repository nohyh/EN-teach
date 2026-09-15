"""账号注册、登录与刷新会话编排。"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_token, decode_token, hash_password, verify_password
from app.db.models import PointsAccount, User
from app.repositories import auth_sessions as sessions_repo
from app.repositories import users as users_repo


class AuthError(ValueError):
    pass


class UsernameTakenError(AuthError):
    pass


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    access_expires_at: datetime
    refresh_expires_at: datetime


class AuthService:
    def register(self, db: Session, *, username: str, password: str, name: str, role: str) -> User:
        if users_repo.get_by_username(db, username):
            raise UsernameTakenError("用户名已存在")
        try:
            user = users_repo.create(
                db,
                username=username,
                password_hash=hash_password(password),
                name=name,
                role=role,
            )
            db.flush()
            db.add(PointsAccount(user_id=user.id, balance=0, version=0))
            db.commit()
            db.refresh(user)
            return user
        except IntegrityError as error:
            db.rollback()
            raise UsernameTakenError("用户名已存在") from error

    def authenticate(self, db: Session, *, username: str, password: str) -> User:
        user = users_repo.get_by_username(db, username)
        if not user or not user.is_active or not verify_password(password, user.password_hash):
            raise AuthError("用户名或密码错误")
        return user

    def issue_token_pair(self, db: Session, user: User) -> TokenPair:
        settings = get_settings()
        access, access_exp, _ = create_token(
            user_id=user.id,
            role=user.role,
            token_type="access",
            expires_delta=timedelta(minutes=settings.access_token_minutes),
        )
        refresh, refresh_exp, refresh_jti = create_token(
            user_id=user.id,
            role=user.role,
            token_type="refresh",
            expires_delta=timedelta(days=settings.refresh_token_days),
        )
        sessions_repo.create(db, user_id=user.id, jti=refresh_jti, expires_at=refresh_exp)
        db.commit()
        return TokenPair(access, refresh, access_exp, refresh_exp)

    def refresh(self, db: Session, refresh_token: str) -> tuple[User, TokenPair]:
        payload = decode_token(refresh_token, expected_type="refresh")
        session = sessions_repo.get_active(db, str(payload["jti"]))
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if not session or session.expires_at <= now:
            raise AuthError("刷新会话已失效")
        user = users_repo.get_by_id(db, int(payload["sub"]))
        if not user or not user.is_active:
            raise AuthError("用户不存在或已停用")
        sessions_repo.revoke(db, session)
        pair = self.issue_token_pair(db, user)
        return user, pair

    def logout(self, db: Session, refresh_token: str) -> None:
        payload = decode_token(refresh_token, expected_type="refresh")
        session = sessions_repo.get_active(db, str(payload["jti"]))
        if session:
            sessions_repo.revoke(db, session)
            db.commit()


_service = AuthService()


def get_auth_service() -> AuthService:
    return _service
