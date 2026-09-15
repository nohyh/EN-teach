"""AI 英语伙伴路由 - 代理 DeepSeek 聊天 / 判定口语对话

POST /api/v1/ai/chat           把最近对话发给 LLM, 返回 {english, translation}
POST /api/v1/ai/dialog-check   判定口语对话的回答, 返回 {correct, feedback, translation, hint}
"""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_optional_current_user
from app.db.database import get_db
from app.db.models import User
from app.services import parent_controls
from app.services.ai_service import AiError, MissingApiKeyError, get_ai_service

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=500)


class ChatRequest(BaseModel):
    # 至少包含一条消息；同时限制客户端提交的历史长度，避免滥用模型上下文。
    # 服务层仍会截取 MAX_HISTORY，形成双重保护。
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)


@router.post("/chat")
def chat(
    req: ChatRequest,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    try:
        parent_controls.ensure_access(db, user, feature="ai")
    except parent_controls.LearningAccessDenied as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    history = [{"role": m.role, "content": m.content} for m in req.messages]
    try:
        english, translation = get_ai_service().chat(history)
    except MissingApiKeyError:
        raise HTTPException(status_code=503, detail="AI 服务暂未配置，请联系老师")
    except AiError:
        raise HTTPException(status_code=502, detail="哎呀，AI 服务开小差了，再试一次好吗？")
    return {"english": english, "translation": translation}


class DialogCheckRequest(BaseModel):
    scene: str = Field(min_length=1, max_length=100)
    goal: str = Field(min_length=1, max_length=200)
    opening: str = Field(min_length=1, max_length=300)
    utterance: str = Field(min_length=1, max_length=300)


@router.post("/dialog-check")
def dialog_check(
    req: DialogCheckRequest,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    try:
        parent_controls.ensure_access(db, user, feature="ai")
    except parent_controls.LearningAccessDenied as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    try:
        result = get_ai_service().judge_dialog(
            req.scene, req.goal, req.opening, req.utterance
        )
    except MissingApiKeyError:
        raise HTTPException(status_code=503, detail="AI 服务暂未配置，请联系老师")
    except AiError:
        raise HTTPException(status_code=502, detail="哎呀，AI 服务开小差了，再试一次好吗？")
    return result
