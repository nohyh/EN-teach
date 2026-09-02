"""口语评测业务

两种实现:
  - MockEvaluator: 假分数, 本地开发 / 前端联调 / SSECP 还没开通时用
  - AliyunSsecpEvaluator: 真实接入阿里云 SSECP
"""
from __future__ import annotations

import random
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from app.core.config import get_settings
from app.services.ssecp_client import SsecpError, get_ssecp_client


@dataclass
class PhonemeScore:
    char: str
    score: float


@dataclass
class WordScore:
    text: str
    score: float
    phonemes: list[PhonemeScore] = field(default_factory=list)


@dataclass
class EvaluationResult:
    overall: float
    accuracy: float
    fluency: float
    integrity: float
    words: list[WordScore]
    raw: dict = field(default_factory=dict)

    @property
    def passed(self) -> bool:
        return self.overall >= get_settings().pass_threshold

    def to_dict(self) -> dict:
        return {
            "overall": self.overall,
            "accuracy": self.accuracy,
            "fluency": self.fluency,
            "integrity": self.integrity,
            "passed": self.passed,
            "words": [
                {
                    "text": w.text,
                    "score": w.score,
                    "phonemes": [{"char": p.char, "score": p.score} for p in w.phonemes],
                }
                for w in self.words
            ],
        }


class Evaluator(ABC):
    @abstractmethod
    def evaluate(
        self,
        audio_bytes: bytes,
        ref_text: str,
        user_id: str | int | None = None,
        audio_type: str = "wav",
    ) -> EvaluationResult: ...


# ---------- Mock 实现 ----------

class MockEvaluator(Evaluator):
    """本地假数据, 不依赖任何外部服务"""

    def evaluate(
        self,
        audio_bytes: bytes,
        ref_text: str,
        user_id: str | int | None = None,
        audio_type: str = "wav",
    ) -> EvaluationResult:
        tokens = [t for t in ref_text.replace("?", "").replace("!", "").replace(".", "").split() if t]
        rng = random.Random(f"{len(audio_bytes)}|{ref_text}")
        overall = round(rng.uniform(70, 98), 1)

        words = []
        for tok in tokens:
            w_score = round(max(40, min(100, overall + rng.uniform(-15, 15))), 1)
            phonemes = [
                PhonemeScore(char=ch, score=round(max(40, min(100, w_score + rng.uniform(-10, 10))), 1))
                for ch in tok
            ]
            words.append(WordScore(text=tok, score=w_score, phonemes=phonemes))

        return EvaluationResult(
            overall=overall,
            accuracy=round(overall + rng.uniform(-3, 3), 1),
            fluency=round(overall + rng.uniform(-5, 5), 1),
            integrity=round(100 if rng.random() > 0.1 else rng.uniform(60, 85), 1),
            words=words,
            raw={"mock": True},
        )


# ---------- 真实 SSECP 实现 ----------

class AliyunSsecpEvaluator(Evaluator):
    """真实接入阿里云智能科教内容生成平台 (SSECP) en.sent_kid.score"""

    def __init__(self) -> None:
        self.client = get_ssecp_client()

    def evaluate(
        self,
        audio_bytes: bytes,
        ref_text: str,
        user_id: str | int | None = None,
        audio_type: str = "wav",
    ) -> EvaluationResult:
        uid = str(user_id) if user_id is not None else "0"
        try:
            raw = self.client.evaluate_kid_sentence(
                user_id=uid,
                audio_bytes=audio_bytes,
                ref_text=ref_text,
                audio_type=audio_type,
            )
        except SsecpError:
            raise
        except Exception as e:
            raise SsecpError(f"SSECP 调用异常: {e}") from e

        return _parse_ssecp_result(raw, ref_text)


def _parse_ssecp_result(raw: dict, ref_text: str) -> EvaluationResult:
    """把 SSECP 返回的 JSON 套到 EvaluationResult 上"""
    result = raw.get("result") or {}
    overall = float(result.get("overall", 0))
    accuracy = float(result.get("accuracy", result.get("pron", overall)))
    fluency_raw = result.get("fluency") or {}
    fluency = (
        float(fluency_raw.get("overall", overall))
        if isinstance(fluency_raw, dict)
        else float(fluency_raw or overall)
    )
    integrity = float(result.get("integrity", 100))

    words: list[WordScore] = []
    for d in result.get("details", []) or []:
        if not isinstance(d, dict):
            continue
        text = d.get("char") or d.get("text") or ""
        score = float(d.get("score", 0))
        phonemes = [
            PhonemeScore(char=p.get("char", ""), score=float(p.get("score", 0)))
            for p in (d.get("phone") or [])
            if isinstance(p, dict)
        ]
        words.append(WordScore(text=text, score=score, phonemes=phonemes))

    return EvaluationResult(
        overall=overall,
        accuracy=accuracy,
        fluency=fluency,
        integrity=integrity,
        words=words,
        raw=raw,
    )


# ---------- 工厂 ----------

_default: Evaluator | None = None


def get_evaluator() -> Evaluator:
    """根据环境变量决定返回 Mock 还是真实实现"""
    global _default
    if _default is not None:
        return _default
    s = get_settings()
    if s.ssecp_app_id and s.ssecp_app_secret:
        _default = AliyunSsecpEvaluator()
    else:
        _default = MockEvaluator()
    return _default
