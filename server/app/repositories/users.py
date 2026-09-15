"""用户数据访问。"""
from sqlalchemy.orm import Session

from app.db.models import User


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def create(
    db: Session,
    *,
    username: str,
    password_hash: str,
    name: str,
    role: str,
) -> User:
    user = User(
        username=username,
        password_hash=password_hash,
        name=name,
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user
