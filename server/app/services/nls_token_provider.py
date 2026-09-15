"""阿里云 NLS Token 缓存与自动刷新。"""
from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass

from app.core.config import get_settings


class NlsTokenError(RuntimeError):
    pass


@dataclass(frozen=True)
class NlsToken:
    value: str
    expires_at: int


class NlsTokenProvider:
    """优先使用 RAM AccessKey 动态刷新，否则兼容手工临时 Token。"""

    refresh_margin_seconds = 5 * 60

    def __init__(self) -> None:
        settings = get_settings()
        self.access_key_id = settings.aliyun_access_key_id
        self.access_key_secret = settings.aliyun_access_key_secret
        self.region_id = settings.aliyun_region_id
        self._token = NlsToken(settings.nls_token, settings.nls_token_expires_at)
        self._lock = threading.Lock()

    def get_token(self) -> str:
        if self._is_usable(self._token):
            return self._token.value
        if not self.access_key_id or not self.access_key_secret:
            if self._token.value and self._token.expires_at == 0:
                return self._token.value
            raise NlsTokenError("NLS Token 已过期，且未配置用于自动刷新的 RAM AccessKey")

        with self._lock:
            if self._is_usable(self._token):
                return self._token.value
            self._token = self._request_token()
            return self._token.value

    def _is_usable(self, token: NlsToken) -> bool:
        if not token.value:
            return False
        if token.expires_at == 0:
            return bool(token.value and not self.access_key_id)
        return token.expires_at - self.refresh_margin_seconds > int(time.time())

    def _request_token(self) -> NlsToken:
        try:
            from aliyunsdkcore.client import AcsClient
            from aliyunsdkcore.request import CommonRequest

            client = AcsClient(self.access_key_id, self.access_key_secret, self.region_id)
            request = CommonRequest()
            request.set_method("POST")
            request.set_domain("nls-meta.cn-shanghai.aliyuncs.com")
            request.set_version("2019-02-28")
            request.set_action_name("CreateToken")
            payload = json.loads(client.do_action_with_exception(request))
            token = payload["Token"]
            return NlsToken(str(token["Id"]), int(token["ExpireTime"]))
        except Exception as error:
            raise NlsTokenError("无法刷新阿里云 NLS Token") from error


_provider: NlsTokenProvider | None = None


def get_nls_token_provider() -> NlsTokenProvider:
    global _provider
    if _provider is None:
        _provider = NlsTokenProvider()
    return _provider
