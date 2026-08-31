from fastapi.testclient import TestClient

from app.api import asr
from app.core.config import Settings
from app.main import create_app
from app.services.asr_service import MissingAsrConfigError
from app.services.audio_utils import pcm16_to_wav
from app.services.evaluation_service import MockEvaluator


def test_settings_allow_clean_start_without_cloud_keys(monkeypatch):
    for key in ("NLS_APPKEY", "NLS_TOKEN", "SSECP_APP_ID", "SSECP_APP_SECRET"):
        monkeypatch.delenv(key, raising=False)
    settings = Settings(_env_file=None)
    assert settings.nls_appkey == ""
    assert settings.nls_token == ""
    assert settings.ssecp_app_id == ""
    assert settings.ssecp_app_secret == ""


def test_pcm16_to_wav_has_valid_header_and_sizes():
    pcm = b"\x00\x01" * 16000
    wav = pcm16_to_wav(pcm)
    assert wav[:4] == b"RIFF"
    assert wav[8:12] == b"WAVE"
    assert wav[36:40] == b"data"
    assert len(wav) == len(pcm) + 44


def test_stateless_pronunciation_evaluation(monkeypatch):
    monkeypatch.setattr(asr, "get_evaluator", lambda: MockEvaluator())
    client = TestClient(create_app())
    response = client.post(
        "/api/v1/speech/evaluate",
        data={"reference_text": "I like apples.", "fmt": "pcm", "sample_rate": "16000"},
        files={"audio": ("speech.pcm", b"\x00\x01" * 8000, "application/octet-stream")},
    )
    assert response.status_code == 200
    body = response.json()
    assert 0 <= body["overall"] <= 100
    assert body["words"]
    assert body["threshold"] == 90.0


def test_speech_audio_size_limit():
    client = TestClient(create_app())
    response = client.post(
        "/api/v1/speech/evaluate",
        data={"reference_text": "apple", "fmt": "pcm", "sample_rate": "16000"},
        files={"audio": ("too-large.pcm", b"0" * (2 * 1024 * 1024 + 1), "application/octet-stream")},
    )
    assert response.status_code == 413


def test_transcribe_reports_missing_configuration(monkeypatch):
    class MissingService:
        def recognize(self, *_args, **_kwargs):
            raise MissingAsrConfigError("语音识别服务暂未配置")

    monkeypatch.setattr(asr, "get_asr_service", lambda: MissingService())
    client = TestClient(create_app())
    response = client.post(
        "/api/v1/speech/transcribe",
        data={"fmt": "pcm", "sample_rate": "16000"},
        files={"audio": ("speech.pcm", b"\x00\x01" * 8000, "application/octet-stream")},
    )
    assert response.status_code == 503
    assert "未配置" in response.json()["detail"]
