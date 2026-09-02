"""DeepSeek 英语助手 API 的本地契约测试（不访问真实网络）。"""

from fastapi.testclient import TestClient

from app.api import ai
from app.main import create_app
from app.services.ai_service import AiError, AiService, MissingApiKeyError


class StubAiService:
    def chat(self, messages):
        assert messages == [{"role": "user", "content": "苹果怎么说？"}]
        return "Apple!", "苹果！"

    def judge_dialog(self, scene, goal, opening, utterance):
        assert (scene, goal, opening, utterance) == (
            "fruit shop",
            "buy an apple",
            "What would you like?",
            "An apple, please.",
        )
        return {
            "correct": True,
            "feedback": "Great job!",
            "translation": "做得好！",
            "hint": "",
        }


def test_chat_returns_english_and_translation(monkeypatch):
    monkeypatch.setattr(ai, "get_ai_service", lambda: StubAiService())
    response = TestClient(create_app()).post(
        "/api/v1/ai/chat",
        json={"messages": [{"role": "user", "content": "苹果怎么说？"}]},
    )
    assert response.status_code == 200
    assert response.json() == {"english": "Apple!", "translation": "苹果！"}


def test_dialog_check_contract(monkeypatch):
    monkeypatch.setattr(ai, "get_ai_service", lambda: StubAiService())
    response = TestClient(create_app()).post(
        "/api/v1/ai/dialog-check",
        json={
            "scene": "fruit shop",
            "goal": "buy an apple",
            "opening": "What would you like?",
            "utterance": "An apple, please.",
        },
    )
    assert response.status_code == 200
    assert response.json()["correct"] is True
    assert response.json()["hint"] == ""


def test_chat_requires_non_empty_bounded_history():
    client = TestClient(create_app())
    assert client.post("/api/v1/ai/chat", json={"messages": []}).status_code == 422
    messages = [{"role": "user", "content": "hello"}] * 21
    assert client.post("/api/v1/ai/chat", json={"messages": messages}).status_code == 422


def test_chat_maps_missing_key_to_503(monkeypatch):
    class MissingKeyService:
        def chat(self, _messages):
            raise MissingApiKeyError("not configured")

    monkeypatch.setattr(ai, "get_ai_service", lambda: MissingKeyService())
    response = TestClient(create_app()).post(
        "/api/v1/ai/chat",
        json={"messages": [{"role": "user", "content": "hello"}]},
    )
    assert response.status_code == 503
    assert "未配置" in response.json()["detail"]


def test_chat_maps_provider_failure_to_502(monkeypatch):
    class FailingService:
        def chat(self, _messages):
            raise AiError("provider unavailable")

    monkeypatch.setattr(ai, "get_ai_service", lambda: FailingService())
    response = TestClient(create_app()).post(
        "/api/v1/ai/chat",
        json={"messages": [{"role": "user", "content": "hello"}]},
    )
    assert response.status_code == 502


def test_empty_structured_ai_reply_is_rejected():
    try:
        AiService._parse_reply('{"english":"", "translation":""}')
    except AiError as error:
        assert "空" in str(error)
    else:
        raise AssertionError("空 AI 回复必须被视为服务异常")
