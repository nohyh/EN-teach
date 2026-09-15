"""API 身份与角色依赖。"""
from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import TokenError, decode_token
from app.db.database import get_db
from app.db.models import User
from app.repositories import users as users_repo


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="请先登录",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token, expected_type="access")
        user = users_repo.get_by_id(db, int(payload["sub"]))
    except (TokenError, TypeError, ValueError):
        raise unauthorized
    if not user or not user.is_active:
        raise unauthorized
    return user


def get_optional_current_user(
    token: str | None = Depends(optional_oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """公开内容允许游客读取，但只有有效登录用户才能带出个人数据。"""
    if not token:
        return None
    try:
        payload = decode_token(token, expected_type="access")
        user = users_repo.get_by_id(db, int(payload["sub"]))
    except (TokenError, TypeError, ValueError):
        return None
    return user if user and user.is_active else None


def require_roles(*roles: str) -> Callable:
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="没有执行此操作的权限")
        return user

    return dependency
