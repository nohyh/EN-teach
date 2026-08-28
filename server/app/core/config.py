"""环境变量集中管理 (pydantic-settings)

所有密钥 / 第三方 API key 都在这里加载, 业务代码不要直接 os.environ。
"""
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# server/ 目录的绝对路径, DB / 音频文件都放这下面
SERVER_DIR = Path(__file__).resolve().parents[2]
_DATA_DIR = SERVER_DIR / "data"
_DATA_DIR.mkdir(exist_ok=True)
_DEFAULT_DB_URL = f"sqlite:///{(_DATA_DIR / 'app.db').as_posix()}"
_DEFAULT_AUDIO_DIR = str(SERVER_DIR / "audio")

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

    # 阿里云 NLS (TTS)
    nls_appkey: str
    nls_token: str
    nls_voice: str = "cally"  # 美式英文女声
    nls_tts_url: str = "https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts"

    # 阿里云 SSECP (口语评测)
    ssecp_app_id: str
    ssecp_app_secret: str
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


@lru_cache
def get_settings() -> Settings:
    """单例, 整个进程只 load 一次"""
    return Settings()
