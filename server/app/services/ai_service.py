"""AI 英语伙伴业务: 调 DeepSeek 聊天, 输出简短英文 + 中文翻译

即 docs/architecture.md 里的 ai_service (LLM, 兼容 OpenAI 接口)。
"""
from __future__ import annotations

import json
import re

import requests

from app.core.config import get_settings

# 每次发给模型的最近消息数, 防止上下文无限膨胀
MAX_HISTORY = 20

SYSTEM_PROMPT = """你是 Lumi，一位给小学低年级孩子（6~9 岁）设计的人工智能英语学习伙伴。
【回答格式】每次回答只输出一个 JSON 对象，不要输出任何其他文字、解释或代码块标记：
{"english": "一句简单的英文回答", "translation": "对应的中文翻译"}
- english：句子要短（不超过 15 个单词），用孩子容易懂的词，语气鼓励、温暖。
- translation：自然、适合孩子理解的中文翻译。
【内容规则】
1. 只聊英语学习相关的话题：问候、动物、颜色、数字、学校、家庭、食物、天气、小故事、简单句型和常用词。
2. 用简单英语回答，需要时把解释放在 translation 里。
3. 如果孩子说了不合适、不安全、暴力、仇恨，或与学习完全无关的内容：用简单英语温和地拒绝，
   并建议孩子去问老师或家长。例如：
   {"english": "That is not something we should talk about. Please ask your teacher or your parents. Let us learn some fun English instead!", "translation": "这个我们不聊哦，请去问问老师或爸爸妈妈吧。我们一起学点有趣的英语！"}
4. 不要假装自己是真人，不要重复孩子的话。
5. 如果孩子说错了，可以温柔地给出正确说法，不要取笑。
现在开始对话，永远只输出上面定义的 JSON。"""


class AiError(Exception):
    """AI 服务调用 / 解析相关错误"""


class MissingApiKeyError(AiError):
    """DEEPSEEK_API_KEY 未配置"""


class AiService:
    """DeepSeek 聊天封装: 拼系统提示词 + 调用 + 解析成 (english, translation)"""

    def __init__(self) -> None:
        s = get_settings()
        self.api_key = s.deepseek_api_key
        self.base_url = s.deepseek_base_url.rstrip("/")
        self.model = s.deepseek_model

    def chat(self, messages: list[dict]) -> tuple[str, str]:
        """把最近的对话发给模型, 返回 (english, translation)"""
        if not self.api_key:
            raise MissingApiKeyError("DEEPSEEK_API_KEY 未设置")

        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *messages[-MAX_HISTORY:]],
            "temperature": 0.6,
            "max_tokens": 600,
            "response_format": {"type": "json_object"},
        }
        try:
            resp = requests.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                timeout=60,
            )
        except requests.RequestException as e:
            raise AiError(f"DeepSeek 请求失败: {e}") from e

        if resp.status_code != 200:
            raise AiError(f"DeepSeek 返回错误: status={resp.status_code}, body={resp.text[:300]}")

        try:
            content = resp.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as e:
            raise AiError(f"DeepSeek 响应解析失败: {e}") from e

        return self._parse_reply(content)

    @staticmethod
    def _parse_reply(content: str) -> tuple[str, str]:
        """解析模型输出的 JSON; 失败时整段当英文"""
        text = content.strip()
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
        try:
            data = json.loads(text)
            english = str(data.get("english") or "").strip()
            translation = str(data.get("translation") or "").strip()
            return english, translation
        except (ValueError, TypeError, AttributeError):
            return text, ""


_service: AiService | None = None


def get_ai_service() -> AiService:
    global _service
    if _service is None:
        _service = AiService()
    return _service
