"""AI 英语伙伴业务: 调 DeepSeek 聊天 / 判定口语对话

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

DIALOG_SYSTEM_PROMPT = """你是 Lumi，水果店大冒险里一位友好的店员。孩子刚学完 "I like ..." 句型，现在要回答你的开场白。
【任务】判断孩子的回答 (utterance) 是不是对开场白 (opening) 的合适英语回答。
【宽松标准】
- 只要说出符合水果店场景的英语（如 "I like apples."、"I like bananas."、"Apple."、"I like apples and oranges."）就算对。
- 单复数、大小写、小语法瑕疵不算错；用中文回答不算对。
- 完全答非所问、或没有用英语回答才算错。
【输出】只输出一个 JSON 对象，不要输出其他内容：
{"correct": true或false, "feedback": "一句简短的英文反馈", "translation": "feedback 的中文翻译", "hint": "如果错了给一句英文提示(例如 I like apples.), 对了就留空字符串"}"""


class AiError(Exception):
    """AI 服务调用 / 解析相关错误"""


class MissingApiKeyError(AiError):
    """DEEPSEEK_API_KEY 未配置"""


class AiService:
    """DeepSeek 封装: 聊天 (english+translation) 与口语对话判定 (correct+feedback+hint)"""

    def __init__(self) -> None:
        s = get_settings()
        self.api_key = s.deepseek_api_key
        self.base_url = s.deepseek_base_url.rstrip("/")
        self.model = s.deepseek_model

    def chat(self, messages: list[dict]) -> tuple[str, str]:
        """把最近的对话发给模型, 返回 (english, translation)"""
        self._require_key()
        content = self._post(
            [{"role": "system", "content": SYSTEM_PROMPT}, *messages[-MAX_HISTORY:]],
            max_tokens=600,
        )
        return self._parse_reply(content)

    def judge_dialog(self, scene: str, goal: str, opening: str, utterance: str) -> dict:
        """判定口语对话的回答, 返回 {correct, feedback, translation, hint}"""
        self._require_key()
        prompt = (
            f"场景: {scene}\n"
            f"目标: {goal}\n"
            f"店员开场白: {opening}\n"
            f"孩子回答: {utterance}\n"
            f"请判定。"
        )
        content = self._post(
            [{"role": "system", "content": DIALOG_SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
            max_tokens=300,
        )
        return self._parse_dialog_check(content)

    def _require_key(self) -> None:
        if not self.api_key:
            raise MissingApiKeyError("DEEPSEEK_API_KEY 未设置")

    def _post(self, messages: list[dict], max_tokens: int) -> str:
        """调用 /chat/completions, 返回模型生成的文本内容"""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.6,
            "max_tokens": max_tokens,
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
            return resp.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as e:
            raise AiError(f"DeepSeek 响应解析失败: {e}") from e

    @staticmethod
    def _parse_reply(content: str) -> tuple[str, str]:
        """解析聊天输出的 JSON; 失败时整段当英文"""
        text = content.strip()
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
        try:
            data = json.loads(text)
            english = str(data.get("english") or "").strip()
            translation = str(data.get("translation") or "").strip()
            return english, translation
        except (ValueError, TypeError, AttributeError):
            return text, ""

    @staticmethod
    def _parse_dialog_check(content: str) -> dict:
        """解析判定输出的 JSON; 失败时判错"""
        text = content.strip()
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
        try:
            data = json.loads(text)
            raw = data.get("correct")
            return {
                "correct": str(raw).strip().lower() in ("true", "1", "yes"),
                "feedback": str(data.get("feedback") or "").strip(),
                "translation": str(data.get("translation") or "").strip(),
                "hint": str(data.get("hint") or "").strip(),
            }
        except (ValueError, TypeError, AttributeError):
            return {"correct": False, "feedback": text, "translation": "", "hint": ""}


_service: AiService | None = None


def get_ai_service() -> AiService:
    global _service
    if _service is None:
        _service = AiService()
    return _service
