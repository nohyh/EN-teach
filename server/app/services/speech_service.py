"""TTS (Text-to-Speech) 业务封装

基于阿里云 NLS REST TTS。文本相同的请求会缓存到本地, 避免重复调用。
"""
from __future__ import annotations

import hashlib
import os
import struct
from pathlib import Path

import requests

from app.core.config import get_settings


def _parse_wav(data: bytes) -> tuple[int, int, int, int, bytes]:
    """解析标准 WAV (44 字节头), 返 (sample_rate, channels, sample_width, pcm_offset, pcm_data)"""
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise ValueError("不是合法 WAV")
    sample_rate = struct.unpack_from("<I", data, 24)[0]
    channels = struct.unpack_from("<H", data, 22)[0]
    bits = struct.unpack_from("<H", data, 34)[0]
    sample_width = bits // 8
    pcm_offset = 44
    pcm_data = data[pcm_offset:]
    return sample_rate, channels, sample_width, pcm_offset, pcm_data


def _make_wav(sample_rate: int, channels: int, sample_width: int, pcm_data: bytes) -> bytes:
    """把 PCM 拼成完整 WAV 文件"""
    byte_rate = sample_rate * channels * sample_width
    block_align = channels * sample_width
    bits = sample_width * 8
    header = b"RIFF" + struct.pack("<I", 36 + len(pcm_data)) + b"WAVE"
    header += b"fmt " + struct.pack("<I", 16)
    header += struct.pack("<H", 1)  # PCM
    header += struct.pack("<H", channels)
    header += struct.pack("<I", sample_rate)
    header += struct.pack("<I", byte_rate)
    header += struct.pack("<H", block_align)
    header += struct.pack("<H", bits)
    header += b"data" + struct.pack("<I", len(pcm_data))
    return header + pcm_data


class SpeechService:
    """TTS 业务: 合成单句 / 多句连读, 支持句间静音"""

    def __init__(self) -> None:
        s = get_settings()
        self.appkey = s.nls_appkey
        self.token = s.nls_token
        self.voice = s.nls_voice
        self.url = s.nls_tts_url
        self.audio_dir = Path(s.audio_storage_dir)
        self.audio_dir.mkdir(parents=True, exist_ok=True)

    # -------- 单句 --------

    def synthesize(
        self,
        text: str,
        fmt: str = "mp3",
        sample_rate: int = 16000,
        speech_rate: int = 0,
    ) -> bytes:
        cache_path = self._cache_path(text, fmt, sample_rate)
        if cache_path.exists():
            return cache_path.read_bytes()

        payload = {
            "appkey": self.appkey,
            "token": self.token,
            "text": text,
            "format": fmt,
            "sample_rate": sample_rate,
            "voice": self.voice,
            "volume": 50,
            "speech_rate": speech_rate,
            "pitch_rate": 0,
        }
        resp = requests.post(self.url, json=payload, timeout=30)
        ctype = resp.headers.get("Content-Type", "")
        if "audio" not in ctype:
            raise RuntimeError(
                f"NLS TTS 失败: status={resp.status_code}, body={resp.text[:300]}"
            )
        cache_path.write_bytes(resp.content)
        return resp.content

    # -------- 多句连读 (带句间静音) --------

    def synth_multi(
        self,
        texts: list[str],
        pause_ms: int = 500,
        fmt: str = "wav",
        sample_rate: int = 16000,
    ) -> bytes:
        """多句连读, 中间插 pause_ms 毫秒静音. 仅支持 wav/pcm (插静音需要 PCM 操作)"""
        if fmt not in ("wav", "pcm"):
            raise ValueError("synth_multi 只支持 wav/pcm, MP3 插静音需要 ffmpeg")
        if not texts:
            raise ValueError("texts 不能为空")

        # 第一句确定参数
        first_wav = self.synthesize(texts[0], fmt="wav", sample_rate=sample_rate)
        sr, ch, sw, _, _ = _parse_wav(first_wav)
        silence_bytes = b"\x00" * int(sr * pause_ms / 1000 * ch * sw)

        pcm_parts: list[bytes] = []
        for i, text in enumerate(texts):
            wav = self.synthesize(text, fmt="wav", sample_rate=sample_rate)
            _, _, _, _, pcm = _parse_wav(wav)
            pcm_parts.append(pcm)
            if i < len(texts) - 1 and pause_ms > 0:
                pcm_parts.append(silence_bytes)

        combined = b"".join(pcm_parts)
        if fmt == "wav":
            return _make_wav(sr, ch, sw, combined)
        return combined

    # -------- 内部 --------

    def _cache_path(self, text: str, fmt: str, sample_rate: int) -> Path:
        key = f"{self.voice}|{fmt}|{sample_rate}|{text}"
        h = hashlib.md5(key.encode("utf-8")).hexdigest()
        return self.audio_dir / f"tts_{h}.{fmt}"


_service: SpeechService | None = None


def get_speech_service() -> SpeechService:
    global _service
    if _service is None:
        _service = SpeechService()
    return _service
