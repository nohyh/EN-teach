"""环境变量集中管理 (pydantic-settings)

所有密钥 / 第三方 API key 都在这里加载, 业务代码不要直接 os.environ。
"""
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# server/ 目录的绝对路径, DB / 音频文件都放这下面
SERVER_DIR = Path(__file__).resolve().parents[2]
_DATA_DIR = SERVER_DIR / "data"
_DATA_DIR.mkdir(exist_ok=True)
_DEFAULT_DB_URL = f"sqlite:///{(_DATA_DIR / 'app.db').as_posix()}"
_DEFAULT_AUDIO_DIR = str(SERVER_DIR / "audio")
_DEFAULT_CONTENT_DIR = str(SERVER_DIR / "data" / "content-assets")

# .env 可能在 server/ 目录 (正常启动 uvicorn) 或上级 (跑 scripts/ 时)
_ENV_FILE = SERVER_DIR / ".env"
if not _ENV_FILE.exists():
    _ENV_FILE = SERVER_DIR.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 阿里云 NLS (TTS + 一句话识别 ASR)
    # 留空仍可启动；调用 ASR/TTS 时返回 503，便于本地只联调 UI/Mock 评分。
    nls_appkey: str = ""
    nls_token: str = ""
    nls_voice: str = "cally"  # 美式英文女声
    nls_tts_url: str = "https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts"
    nls_asr_url: str = "https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr"
    nls_token_expires_at: int = 0
    aliyun_access_key_id: str = ""
    aliyun_access_key_secret: str = ""
    aliyun_region_id: str = "cn-shanghai"

    # 阿里云 SSECP (口语评测)
    # 留空时跟读评测自动使用 MockEvaluator。
    ssecp_app_id: str = ""
    ssecp_app_secret: str = ""
    ssecp_user_client_ip: str = "127.0.0.1"
    ssecp_auth_urls: str = (
        "https://api.cloud.ssapi.cn/auth/authorize,"
        "https://gate-01.api.cloud.ssapi.cn/auth/authorize,"
        "https://gate-02.api.cloud.ssapi.cn/auth/authorize,"
        "https://gate-03.api.cloud.ssapi.cn/auth/authorize"
    )
    ssecp_eval_url_template: str = (
        "wss://api.cloud.ssapi.cn/{core_type}?connect_id={connect_id}"
    )

    # 后端 (留空则用默认: server/data/app.db, server/audio)
    database_url: str = _DEFAULT_DB_URL
    audio_storage_dir: str = _DEFAULT_AUDIO_DIR
    content_storage_dir: str = _DEFAULT_CONTENT_DIR
    content_max_upload_mb: int = Field(default=25, ge=1, le=200)

    # 应用与鉴权
    app_env: str = "development"
    jwt_secret_key: str = "development-only-change-me-before-production"
    jwt_issuer: str = "en-teach"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    cors_origins: str = (
        "http://localhost:8081,http://127.0.0.1:8081,"
        "http://localhost:8083,http://127.0.0.1:8083"
    )
    log_level: str = "INFO"
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = Field(default=0.0, ge=0.0, le=1.0)

    # 评测业务
    pass_threshold: float = 90.0  # 单词 / 句子 overall >= 90 算过

    # DeepSeek (AI 英语伙伴)
    deepseek_api_key: str = ""            # 空 = 未配置, /api/v1/ai/chat 返回 503
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"

    @field_validator("database_url", mode="before")
    @classmethod
    def _default_db_url(cls, v: str) -> str:
        """env 里留空时, 用绝对路径默认"""
        return v or _DEFAULT_DB_URL

    @field_validator("audio_storage_dir", mode="before")
    @classmethod
    def _default_audio_dir(cls, v: str) -> str:
        return v or _DEFAULT_AUDIO_DIR

    @field_validator("content_storage_dir", mode="before")
    @classmethod
    def _default_content_dir(cls, v: str) -> str:
        return v or _DEFAULT_CONTENT_DIR

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def _validate_production_secrets(self):
        if self.app_env == "production" and self.jwt_secret_key.startswith("development-"):
            raise ValueError("生产环境必须配置独立的 JWT_SECRET_KEY")
        return self


@lru_cache
def get_settings() -> Settings:
    """单例, 整个进程只 load 一次"""
    return Settings()
