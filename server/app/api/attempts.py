"""POST /api/v1/attempts - 跟读提交 (核心路径)

流程:
  1. 校验 audio 格式 (扩展名 + MIME)
  2. 落盘到 audio/
  3. 调 evaluation_service 拿分
  4. 写 attempts 表
  5. 如果该用户该 unit 全部句子都过, 标 unit completed
"""
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import models
from app.db.database import get_db
from app.repositories import attempts as attempts_repo
from app.repositories import units as units_repo
from app.services.evaluation_service import get_evaluator

router = APIRouter(prefix="/api/v1/attempts", tags=["attempts"])
MAX_AUDIO_BYTES = 2 * 1024 * 1024

ALLOWED_AUDIO_EXT = {".wav", ".pcm", ".ogg", ".opus"}
ALLOWED_AUDIO_MIME = {
    "audio/wav", "audio/x-wav", "audio/wave",
    "audio/pcm", "application/octet-stream",
    "audio/ogg", "audio/opus", "audio/ogg;codecs=opus",
}


@router.post("")
async def submit_attempt(
    user_id: int = Form(...),
    sentence_id: str = Form(...),
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    sentence = units_repo.get_sentence(db, sentence_id)
    if not sentence:
        raise HTTPException(status_code=404, detail="Sentence not found")

    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 格式校验
    filename = audio.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext and ext not in ALLOWED_AUDIO_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio extension: {ext!r}. Allowed: {sorted(ALLOWED_AUDIO_EXT)}",
        )
    if audio.content_type and audio.content_type not in ALLOWED_AUDIO_MIME:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio content_type: {audio.content_type!r}. Allowed: {sorted(ALLOWED_AUDIO_MIME)}",
        )

    audio_bytes = await audio.read(MAX_AUDIO_BYTES + 1)
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file cannot exceed 2 MiB")

    s = get_settings()
    audio_dir = Path(s.audio_storage_dir)
    audio_dir.mkdir(parents=True, exist_ok=True)
    audio_path = audio_dir / f"{uuid.uuid4().hex}{ext or '.wav'}"
    audio_path.write_bytes(audio_bytes)

    evaluator = get_evaluator()
    # 引擎要知道是 wav 还是 ogg 等, 之前默认 "ogg" 是个 bug, 现在按真实格式传
    audio_type = ext.lstrip(".") or "wav"
    result = evaluator.evaluate(audio_bytes, sentence.text, user_id=user_id, audio_type=audio_type)

    word_scores = [
        {"text": w.text, "score": w.score, "phonemes": [{"char": p.char, "score": p.score} for p in w.phonemes]}
        for w in result.words
    ]
    attempt = attempts_repo.insert_attempt(
        db,
        user_id=user_id,
        sentence_id=sentence_id,
        audio_path=str(audio_path),
        overall=result.overall,
        accuracy=result.accuracy,
        fluency=result.fluency,
        integrity=result.integrity,
        passed=result.passed,
        word_scores=word_scores,
        raw=result.raw,
    )

    # 检查该用户该 unit 是否全部通过, 是则标记完成
    if attempt.passed:
        unit_sentences = db.query(models.Sentence).filter_by(unit_id=sentence.unit_id).all()
        all_sentence_ids = {s.id for s in unit_sentences}
        passed_ids = attempts_repo.passed_sentence_ids_in(db, user_id, list(all_sentence_ids))
        if all_sentence_ids.issubset(passed_ids):
            attempts_repo.mark_unit_completed(db, user_id, sentence.unit_id)
        else:
            attempts_repo.mark_unit_in_progress(db, user_id, sentence.unit_id)

    db.commit()
    db.refresh(attempt)

    return {
        "attempt_id": attempt.id,
        "sentence_id": sentence_id,
        "overall": result.overall,
        "accuracy": result.accuracy,
        "fluency": result.fluency,
        "integrity": result.integrity,
        "passed": attempt.passed,
        "threshold": s.pass_threshold,
        "words": word_scores,
    }


@router.get("/by-speech/{sentence_id}")
def list_attempts(
    sentence_id: str,
    user_id: int,
    db: Session = Depends(get_db),
):
    return attempts_repo.list_attempts_for_sentence(db, user_id, sentence_id)
