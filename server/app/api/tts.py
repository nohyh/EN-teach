"""TTS 路由 - 给句子合成标准发音

支持:
  GET  /api/v1/tts/sentence/{id}         单句
  GET  /api/v1/tts/sentences?ids=...      多句连读, 带句间静音
  GET  /api/v1/tts/unit/{id}?pause_ms=   整 unit 连读
  POST /api/v1/tts/synthesize?text=      任意文本合成
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.repositories import units as units_repo
from app.services.speech_service import get_speech_service

router = APIRouter(prefix="/api/v1/tts", tags=["tts"])


@router.get("/sentence/{sentence_id}")
def synth_for_sentence(
    sentence_id: str,
    fmt: str = Query("mp3", pattern="^(mp3|wav|pcm)$"),
    db: Session = Depends(get_db),
):
    sentence = units_repo.get_sentence(db, sentence_id)
    if not sentence:
        raise HTTPException(status_code=404, detail="Sentence not found")

    audio = get_speech_service().synthesize(sentence.text, fmt=fmt)
    return Response(
        content=audio,
        media_type={"mp3": "audio/mpeg", "wav": "audio/wav", "pcm": "audio/L16"}[fmt],
    )


@router.get("/sentences")
def synth_multiple_sentences(
    ids: str = Query(..., description="逗号分隔 sentence id 列表"),
    fmt: str = Query("wav", pattern="^(wav|pcm|mp3)$"),
    pause_ms: int = Query(600, ge=0, le=5000, description="句间静音毫秒, 0=不插静音"),
    db: Session = Depends(get_db),
):
    """按 ID 列表合成多句, 适合对话朗读 (默认 600ms 间隔)"""
    id_list = [s.strip() for s in ids.split(",") if s.strip()]
    if not id_list:
        raise HTTPException(status_code=400, detail="ids 不能为空")
    if len(id_list) > 50:
        raise HTTPException(status_code=400, detail="一次最多 50 句")

    by_id: dict[str, object] = {}
    for sid in id_list:
        s = units_repo.get_sentence(db, sid)
        if s:
            by_id[sid] = s
    missing = [i for i in id_list if i not in by_id]
    if missing:
        raise HTTPException(status_code=404, detail=f"找不到句子: {missing}")

    texts = [by_id[i].text for i in id_list]  # type: ignore[union-attr]
    svc = get_speech_service()
    if pause_ms > 0 and fmt != "mp3":
        audio = svc.synth_multi(texts, pause_ms=pause_ms, fmt=fmt)
    else:
        chunks = [svc.synthesize(t, fmt=fmt) for t in texts]
        audio = b"".join(chunks)
    return Response(
        content=audio,
        media_type={"mp3": "audio/mpeg", "wav": "audio/wav", "pcm": "audio/L16"}[fmt],
    )


@router.get("/unit/{unit_id}")
def synth_whole_unit(
    unit_id: str,
    fmt: str = Query("wav", pattern="^(wav|pcm|mp3)$"),
    pause_ms: int = Query(600, ge=0, le=5000),
    db: Session = Depends(get_db),
):
    """把整个 unit 的所有句子串成一段音频 (用于 '整课播放' / '先听一遍')"""
    sentences = units_repo.get_sentences_for_unit(db, unit_id)
    if sentences is None:
        raise HTTPException(status_code=404, detail="Unit not found")
    if not sentences:
        raise HTTPException(status_code=404, detail="Unit has no sentences")

    texts = [s["text"] for s in sentences]
    svc = get_speech_service()
    if pause_ms > 0 and fmt != "mp3":
        audio = svc.synth_multi(texts, pause_ms=pause_ms, fmt=fmt)
    else:
        chunks = [svc.synthesize(t, fmt=fmt) for t in texts]
        audio = b"".join(chunks)
    return Response(
        content=audio,
        media_type={"mp3": "audio/mpeg", "wav": "audio/wav", "pcm": "audio/L16"}[fmt],
    )


@router.post("/synthesize")
def synth_raw_text(
    text: str = Query(..., min_length=1, max_length=1000),
    fmt: str = Query("mp3", pattern="^(mp3|wav|pcm)$"),
):
    """直接传入文本合成 (调试 / 预览用)"""
    audio = get_speech_service().synthesize(text, fmt=fmt)
    return Response(
        content=audio,
        media_type={"mp3": "audio/mpeg", "wav": "audio/wav", "pcm": "audio/L16"}[fmt],
    )
