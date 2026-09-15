"""密码哈希与 JWT 签发/校验。"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import jwt
from jwt import InvalidTokenError
from pwdlib import PasswordHash

from app.core.config import get_settings


password_hasher = PasswordHash.recommended()


class TokenError(ValueError):
    """JWT 无效、过期或类型错误。"""


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash or password_hash.startswith("!"):
        return False
    try:
        return password_hasher.verify(password, password_hash)
    except Exception:
        return False


def create_token(
    *,
    user_id: int,
    role: str,
    token_type: str,
    expires_delta: timedelta,
    jti: str | None = None,
) -> tuple[str, datetime, str]:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expires_at = now + expires_delta
    token_jti = jti or uuid4().hex
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "type": token_type,
        "jti": token_jti,
        "iat": now,
        "exp": expires_at,
        "iss": settings.jwt_issuer,
    }
    encoded = jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")
    return encoded, expires_at, token_jti


def decode_token(token: str, *, expected_type: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=["HS256"],
            issuer=settings.jwt_issuer,
            options={"require": ["sub", "type", "jti", "iat", "exp", "iss"]},
        )
    except InvalidTokenError as error:
        raise TokenError("登录凭证无效或已过期") from error
    if payload.get("type") != expected_type:
        raise TokenError("登录凭证类型错误")
    return payload
