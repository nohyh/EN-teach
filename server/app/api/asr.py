"""语音识别路由 - 把前端录音转成文字 (AI 伙伴 + 口语对话的"说英文转文字")"""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import get_settings
from app.services.asr_service import AsrError, MissingAsrConfigError, get_asr_service
from app.services.audio_utils import pcm16_to_wav
from app.services.evaluation_service import get_evaluator
from app.services.ssecp_client import SsecpError

router = APIRouter(prefix="/api/v1/speech", tags=["speech"])

# 前端按 PCM 上传; 兼容其他编码, 但采样率只支持 8000/16000
SUPPORTED_FORMATS = {"pcm", "wav", "ogg", "opus", "mp3", "m4a"}
SUPPORTED_RATES = {8000, 16000}
MAX_AUDIO_BYTES = 2 * 1024 * 1024


async def _read_audio(audio: UploadFile) -> bytes:
    # 多读 1 字节即可判断超限，避免无界读入恶意/误选的大文件。
    audio_bytes = await audio.read(MAX_AUDIO_BYTES + 1)
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="音频为空")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="音频不能超过 2 MiB")
    return audio_bytes


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    fmt: str = Form("pcm"),
    sample_rate: int = Form(16000),
):
    if fmt not in SUPPORTED_FORMATS:
        raise HTTPException(status_code=400, detail=f"不支持的音频格式: {fmt}")
    if sample_rate not in SUPPORTED_RATES:
        raise HTTPException(status_code=400, detail="sample_rate 只支持 8000 或 16000")

    audio_bytes = await _read_audio(audio)

    try:
        text = get_asr_service().recognize(audio_bytes, fmt=fmt, sample_rate=sample_rate)
    except MissingAsrConfigError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except AsrError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return {"text": text}


@router.post("/evaluate")
async def evaluate(
    reference_text: str = Form(...),
    audio: UploadFile = File(...),
    user_id: str = Form("mobile-demo"),
    fmt: str = Form("pcm"),
    sample_rate: int = Form(16000),
):
    """给前端本地课程做无数据库依赖的跟读评分。"""
    reference_text = reference_text.strip()
    if not reference_text or len(reference_text) > 500:
        raise HTTPException(status_code=400, detail="reference_text 长度需为 1-500")
    if fmt not in {"pcm", "wav", "ogg", "opus"}:
        raise HTTPException(status_code=400, detail=f"不支持的评测音频格式: {fmt}")
    if sample_rate != 16000:
        raise HTTPException(status_code=400, detail="跟读评分只支持 16000 Hz")

    audio_bytes = await _read_audio(audio)
    evaluation_audio = pcm16_to_wav(audio_bytes, sample_rate=sample_rate) if fmt == "pcm" else audio_bytes
    evaluation_format = "wav" if fmt == "pcm" else fmt
    try:
        result = get_evaluator().evaluate(
            evaluation_audio,
            reference_text,
            user_id=user_id,
            audio_type=evaluation_format,
        )
    except SsecpError as e:
        raise HTTPException(status_code=502, detail=f"跟读评分服务暂时不可用: {e}") from e

    settings = get_settings()
    return {
        **result.to_dict(),
        "threshold": settings.pass_threshold,
        "mode": "aliyun" if settings.ssecp_app_id and settings.ssecp_app_secret else "mock",
    }
