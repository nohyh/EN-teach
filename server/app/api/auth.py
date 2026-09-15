"""真实账号、JWT 访问令牌和可撤销刷新会话。"""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.security import TokenError
from app.db.database import get_db
from app.db.models import User
from app.services.auth_service import AuthError, UsernameTakenError, get_auth_service


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=64)
    role: Literal["student", "parent"] = "student"

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.strip().lower()


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    name: str
    role: str
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    token_type: Literal["bearer"] = "bearer"
    access_token: str
    refresh_token: str
    access_expires_at: datetime
    refresh_expires_at: datetime
    user: UserResponse


def _token_response(user: User, pair) -> TokenResponse:
    return TokenResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        access_expires_at=pair.access_expires_at,
        refresh_expires_at=pair.refresh_expires_at,
        user=UserResponse.model_validate(user),
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    try:
        return get_auth_service().register(db, **request.model_dump())
    except UsernameTakenError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    try:
        user = get_auth_service().authenticate(
            db,
            username=request.username.strip().lower(),
            password=request.password,
        )
        return _token_response(user, get_auth_service().issue_token_pair(db, user))
    except AuthError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


@router.post("/refresh", response_model=TokenResponse)
def refresh(request: RefreshRequest, db: Session = Depends(get_db)):
    try:
        user, pair = get_auth_service().refresh(db, request.refresh_token)
        return _token_response(user, pair)
    except (AuthError, TokenError) as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: RefreshRequest, db: Session = Depends(get_db)):
    try:
        get_auth_service().logout(db, request.refresh_token)
    except TokenError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return user
