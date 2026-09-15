"""刷新会话数据访问。"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.models import AuthSession


def create(db: Session, *, user_id: int, jti: str, expires_at: datetime) -> AuthSession:
    session = AuthSession(user_id=user_id, jti=jti, expires_at=expires_at.replace(tzinfo=None))
    db.add(session)
    db.flush()
    return session


def get_active(db: Session, jti: str) -> AuthSession | None:
    return (
        db.query(AuthSession)
        .filter(AuthSession.jti == jti, AuthSession.revoked_at.is_(None))
        .first()
    )


def revoke(db: Session, session: AuthSession) -> None:
    session.revoked_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.flush()
