"""语音识别路由 - 把前端录音转成文字 (AI 伙伴 + 口语对话的"说英文转文字")"""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services.asr_service import AsrError, get_asr_service

router = APIRouter(prefix="/api/v1/speech", tags=["speech"])

# 前端按 PCM 上传; 兼容其他编码, 但采样率只支持 8000/16000
SUPPORTED_FORMATS = {"pcm", "wav", "ogg", "opus", "mp3", "m4a"}
SUPPORTED_RATES = {8000, 16000}


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

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="音频为空")

    try:
        text = get_asr_service().recognize(audio_bytes, fmt=fmt, sample_rate=sample_rate)
    except AsrError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"text": text}
