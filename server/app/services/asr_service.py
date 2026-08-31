"""阿里云 NLS 一句话识别 (短语音 ASR) 业务封装

把一段 <60s 的音频转成文字。请求: URL query 带参数, X-NLS-Token 头鉴权,
body 是裸音频二进制 (PCM 16bit mono, 8000/16000Hz)。
"""
from __future__ import annotations

import requests

from app.core.config import get_settings


class AsrError(Exception):
    """阿里云 ASR 调用失败"""


class MissingAsrConfigError(AsrError):
    """ASR 所需的阿里云 NLS 配置缺失。"""


class AsrService:
    def __init__(self) -> None:
        s = get_settings()
        self.appkey = s.nls_appkey
        self.token = s.nls_token
        self.url = s.nls_asr_url

    def recognize(self, audio: bytes, fmt: str = "pcm", sample_rate: int = 16000) -> str:
        """返回识别文本; 失败抛 AsrError"""
        if not self.appkey or not self.token:
            raise MissingAsrConfigError("语音识别服务暂未配置")
        params = {
            "appkey": self.appkey,
            "format": fmt,
            "sample_rate": sample_rate,
            "enable_punctuation_prediction": "true",
            "enable_inverse_text_normalization": "true",
            "enable_voice_detection": "true",
        }
        headers = {
            "X-NLS-Token": self.token,
            "Content-Type": "application/octet-stream",
        }
        try:
            resp = requests.post(self.url, params=params, headers=headers, data=audio, timeout=30)
            data = resp.json()
        except (requests.RequestException, ValueError) as e:
            raise AsrError(f"阿里云 ASR 请求失败: {e}") from e

        if data.get("status") != 20000000:
            raise AsrError(
                f"阿里云 ASR 失败: status={data.get('status')}, "
                f"message={data.get('message') or data.get('status_text')}"
            )
        text = str(data.get("result") or "").strip()
        if not text:
            raise AsrError("没有识别到清晰的语音，请靠近麦克风再试一次")
        return text


_service: AsrService | None = None


def get_asr_service() -> AsrService:
    global _service
    if _service is None:
        _service = AsrService()
    return _service
