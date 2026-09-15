"""阿里云 NLS Token 缓存与刷新策略测试。"""
import threading
import time

import pytest

from app.services.nls_token_provider import NlsToken, NlsTokenError, NlsTokenProvider


def _provider(*, token: str = "", expires_at: int = 0, access_keys: bool = False):
    provider = object.__new__(NlsTokenProvider)
    provider.access_key_id = "key-id" if access_keys else ""
    provider.access_key_secret = "key-secret" if access_keys else ""
    provider.region_id = "cn-shanghai"
    provider._token = NlsToken(token, expires_at)
    provider._lock = threading.Lock()
    return provider


def test_static_token_remains_backward_compatible():
    assert _provider(token="manual-token").get_token() == "manual-token"


def test_expiring_token_is_refreshed_and_cached(monkeypatch):
    provider = _provider(
        token="expired-token",
        expires_at=int(time.time()) - 1,
        access_keys=True,
    )
    calls = []

    def request_token():
        calls.append(True)
        return NlsToken("fresh-token", int(time.time()) + 3600)

    monkeypatch.setattr(provider, "_request_token", request_token)
    assert provider.get_token() == "fresh-token"
    assert provider.get_token() == "fresh-token"
    assert len(calls) == 1


def test_missing_token_and_access_keys_has_clear_error():
    with pytest.raises(NlsTokenError, match="未配置"):
        _provider().get_token()
