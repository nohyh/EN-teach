"""一键验证语音能力: 念英语 (TTS) + 听英语打分 (SSECP 评测 + attempts)

覆盖: 鉴权 / TTS 合成 / 评测打分 / FastAPI attempts 提交。
不需要真实麦克风, 用 TTS 标准发音当样本喂给评测引擎。

用法:
    python scripts/seed_db.py        # 先灌数据 (attempts 步骤需要 apple 句子 + child 账号)
    python scripts/verify_speech.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVER = ROOT / "server"
for _p in (str(ROOT), str(SERVER)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from app.services.evaluation_service import get_evaluator  # noqa: E402
from app.services.speech_service import get_speech_service  # noqa: E402
from app.services.ssecp_client import get_ssecp_client  # noqa: E402

PASS = "[OK]   "
FAIL = "[FAIL] "


def step(name, fn):
    print(f"\n=== {name} ===")
    try:
        fn()
        print(f"{PASS}{name}")
    except Exception as e:
        print(f"{FAIL}{name}: {type(e).__name__}: {e}")


def check_warrant():
    c = get_ssecp_client()
    w = c.request_warrant("verify-speech")
    print(f"  warrant_id = {w.warrant_id}, expire_at = {w.expire_at}")


def check_tts():
    svc = get_speech_service()
    audio = svc.synthesize("apple", fmt="mp3")
    head = audio[:4].hex()
    print(f"  size = {len(audio)} bytes, head = {head} (fff3=MP3, 5249=WAV)")


def check_eval():
    """念 + 打分一条链: TTS 念出 apple -> 评测引擎打分 (标准发音应高分)"""
    svc = get_speech_service()
    audio = svc.synthesize("apple", fmt="wav")
    res = get_evaluator().evaluate(audio, "apple", user_id="verify-speech", audio_type="wav")
    print(f"  overall = {res.overall}, accuracy = {res.accuracy}, passed = {res.passed}")
    print(f"  words   = {[(w.text, w.score) for w in res.words]}")
    if res.overall < 50:
        raise RuntimeError("TTS 标准发音应拿高分, overall<50 说明评测链路有问题")


def check_attempts():
    from fastapi.testclient import TestClient

    from app.main import app

    svc = get_speech_service()
    audio = svc.synthesize("apple", fmt="wav")
    client = TestClient(app)
    resp = client.post(
        "/api/v1/attempts",
        data={"user_id": 2, "sentence_id": "unit-fruit-sent-1"},
        files={"audio": ("apple.wav", audio, "audio/wav")},
    )
    data = resp.json()
    print(f"  HTTP       = {resp.status_code}")
    print(f"  attempt_id = {data.get('attempt_id')}, overall = {data.get('overall')}, "
          f"passed = {data.get('passed')}")
    print(f"  words      = {len(data.get('words', []))}")


if __name__ == "__main__":
    print("=" * 60)
    print("语音能力验证: 念英语 (TTS) + 听英语打分 (SSECP)")
    print("=" * 60)
    step("1/4 SSECP 鉴权", check_warrant)
    step("2/4 NLS TTS 合成 (念)", check_tts)
    step("3/4 SSECP 评测 (听+打分, TTS 样本)", check_eval)
    step("4/4 FastAPI /api/v1/attempts", check_attempts)
    print()
    print("4 步全 [OK] = 语音能力端到端通 (attempts 步骤依赖 seed_db)")
