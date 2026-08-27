"""SSECP (阿里云智能科教内容生成平台) 鉴权 + WebSocket 评测客户端

参考:
- 鉴权: https://help.aliyun.com/document_detail/2865622.html
- 题型 (en.sent_kid.score): https://help.aliyun.com/document_detail/2996318.html
- WebSocket 协议: SSECP JS SDK v3.0.5 engine.js
"""
from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass
from hashlib import md5
from typing import Optional

import requests
import websocket  # websocket-client

from app.core.config import get_settings


# 音频切块大小 (4KB 是个常见值)
AUDIO_CHUNK_BYTES = 4 * 1024
AUDIO_CHUNK_INTERVAL_S = 0.02  # 每片 20ms


@dataclass
class Warrant:
    warrant_id: str
    expire_at: int  # unix timestamp (秒)


class SsecpError(RuntimeError):
    pass


class SsecpClient:
    def __init__(self) -> None:
        s = get_settings()
        self.app_id = s.ssecp_app_id
        self.app_secret = s.ssecp_app_secret
        self.user_client_ip = s.ssecp_user_client_ip
        self.auth_urls = [u.strip() for u in s.ssecp_auth_urls.split(",") if u.strip()]
        self.eval_url_template = s.ssecp_eval_url_template

        # per-user 缓存 warrant (SSECP 限制: 获取 warrant 用的 user_id 必须和评测时一致)
        self._warrant_cache: dict[str, Warrant] = {}

    # -------- 鉴权 --------

    def _generate_auth_sign(
        self, app_id: str, timestamp: int, user_id: str, app_secret: str
    ) -> str:
        """鉴权接口 sig: MD5(排序后的 key=value 拼接), 末尾不含 &"""
        params = {
            "appid": app_id,
            "timestamp": str(timestamp),
            "user_id": user_id,
            "user_client_ip": self.user_client_ip,
            "app_secret": app_secret,
        }
        sorted_items = sorted(params.items())
        query_string = "&".join(f"{k}={v}" for k, v in sorted_items)
        return md5(query_string.encode("utf-8")).hexdigest()

    def request_warrant(self, user_id: str, warrant_available: int = 7200) -> Warrant:
        """调 /auth/authorize 拿 warrant_id, 失败就轮询下一个 URL"""
        timestamp = int(time.time())
        sign = self._generate_auth_sign(self.app_id, timestamp, user_id, self.app_secret)

        form = {
            "appid": self.app_id,
            "timestamp": str(timestamp),
            "user_id": user_id,
            "user_client_ip": self.user_client_ip,
            "request_sign": sign,
            "warrant_available": str(warrant_available),
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        last_err: Optional[Exception] = None
        for url in self.auth_urls:
            try:
                resp = requests.post(url, data=form, headers=headers, timeout=15)
            except requests.RequestException as e:
                last_err = e
                continue
            if resp.status_code != 200:
                last_err = SsecpError(f"auth HTTP {resp.status_code}: {resp.text[:200]}")
                continue
            try:
                payload = resp.json()
            except json.JSONDecodeError:
                last_err = SsecpError(f"auth 非 JSON 响应: {resp.text[:200]}")
                continue
            if payload.get("code") != 0:
                last_err = SsecpError(
                    f"auth 业务错: code={payload.get('code')} msg={payload.get('msg')}"
                )
                continue
            data = payload.get("data") or {}
            warrant = Warrant(warrant_id=data["warrant_id"], expire_at=int(data["expire_at"]))
            self._warrant_cache[user_id] = warrant
            return warrant

        raise SsecpError(f"所有鉴权 URL 都失败, 最后错误: {last_err!r}")

    def get_warrant(self, user_id: str) -> Warrant:
        """拿可用 warrant, 过期或没有就重新申请"""
        cached = self._warrant_cache.get(user_id)
        # 提前 60s 续期, 避免边界
        if cached and cached.expire_at - 60 > int(time.time()):
            return cached
        return self.request_warrant(user_id)

    # -------- 评测引擎的包级 sig --------

    def _packet_sig(self, timestamp: int) -> str:
        """WebSocket connect/start 包的 signature 字段, sha1(appid + secret + ts)"""
        raw = f"{self.app_id}{self.app_secret}{timestamp}"
        import hashlib
        return hashlib.sha1(raw.encode("utf-8")).hexdigest()

    # -------- WebSocket 评测 --------

    def evaluate_kid_sentence(
        self,
        user_id: str,
        audio_bytes: bytes,
        ref_text: str,
        core_type: str = "en.sent_kid.score",
        audio_type: str = "ogg",
        sample_rate: int = 16000,
        timeout: int = 30,
    ) -> dict:
        """走 wss://, 题型由 core_type 决定 (默认 en.sent_kid.score 儿童英文句子)"""
        warrant = self.get_warrant(user_id)
        connect_id = uuid.uuid4().hex
        token_id = uuid.uuid4().hex
        request_id = uuid.uuid4().hex
        ts_connect = int(time.time())
        ts_start = int(time.time())

        ws_url = self.eval_url_template.format(
            core_type=core_type, connect_id=connect_id
        )

        return self._ws_evaluate(
            ws_url=ws_url,
            warrant=warrant,
            connect_id=connect_id,
            token_id=token_id,
            request_id=request_id,
            ts_connect=ts_connect,
            ts_start=ts_start,
            user_id=user_id,
            ref_text=ref_text,
            core_type=core_type,
            audio_type=audio_type,
            sample_rate=sample_rate,
            output_phones=True,
            audio_bytes=audio_bytes,
            timeout=timeout,
        )

    def _ws_evaluate(
        self,
        ws_url: str,
        warrant: Warrant,
        connect_id: str,
        token_id: str,
        request_id: str,
        ts_connect: int,
        ts_start: int,
        user_id: str,
        ref_text: str,
        core_type: str,
        audio_type: str,
        sample_rate: int,
        output_phones: bool,
        audio_bytes: bytes,
        timeout: int,
    ) -> dict:
        # SDK 标识: 7 = windows, version 任意
        sdk = {
            "version": 16778752,
            "source": 7,
            "protocol": 1,  # 1=websocket
            "arch": "x86_64",
            "os": "windows",
            "os_version": "10",
            "product": "demo8-server",
        }

        connect_packet = {
            "cmd": "connect",
            "param": {
                "app": {
                    "applicationId": self.app_id,
                    "connect_id": connect_id,
                    "timestamp": str(ts_connect),
                    "warrantId": warrant.warrant_id,
                    # 引擎要求 userId 在 connect 包里也带上, 否则 warrant check 报 41030
                    "userId": user_id,
                    "signature": self._packet_sig(ts_connect),
                },
                "sdk": sdk,
            },
        }

        start_packet = {
            "cmd": "start",
            "param": {
                "app": {
                    "applicationId": self.app_id,
                    "connect_id": connect_id,
                    "timestamp": str(ts_start),
                    "warrantId": warrant.warrant_id,
                    "userId": user_id,
                    "clientId": "",
                    "signature": self._packet_sig(ts_start),
                },
                "audio": {
                    "sampleRate": sample_rate,
                    "channel": 1,
                    "sampleBytes": 2,
                    "audioType": audio_type,
                },
                "request": {
                    "coreType": core_type,
                    "refText": ref_text,
                    "rank": 100,
                    "outputPhones": 1 if output_phones else 0,
                    "phdet": 1 if output_phones else 0,
                    "attachAudioUrl": 1,
                    "tokenId": token_id,
                    "request_id": request_id,
                },
            },
        }

        end_packet = {"cmd": "end"}

        ws = websocket.create_connection(ws_url, timeout=timeout)
        try:
            # 1. connect (引擎不响应 connect 包, 直接接 start)
            ws.send(json.dumps(connect_packet))

            # 2. start
            ws.send(json.dumps(start_packet))

            # 3. binary audio frames (切 4KB 块)
            for offset in range(0, len(audio_bytes), AUDIO_CHUNK_BYTES):
                chunk = audio_bytes[offset : offset + AUDIO_CHUNK_BYTES]
                ws.send_binary(chunk)
                if AUDIO_CHUNK_INTERVAL_S > 0:
                    time.sleep(AUDIO_CHUNK_INTERVAL_S)

            # 4. end
            ws.send(json.dumps(end_packet))

            # 5. 收 result, 一直收到 eof=1 或超时
            last_payload: dict | None = None
            deadline = time.time() + timeout
            while time.time() < deadline:
                ws.settimeout(max(0.1, deadline - time.time()))
                try:
                    raw = ws.recv()
                except websocket.WebSocketTimeoutException:
                    break
                if not raw:
                    continue
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if isinstance(msg, dict) and msg.get("errId") not in (0, None, "0"):
                    raise SsecpError(
                        f"引擎错: errId={msg.get('errId')} err={msg.get('error') or msg.get('message')}"
                    )
                if isinstance(msg, dict) and msg.get("result"):
                    last_payload = msg
                if isinstance(msg, dict) and msg.get("eof") == 1:
                    break
            if last_payload is None:
                raise SsecpError("未收到 result 报文 (eof=1 也没等到)")
            return last_payload
        finally:
            try:
                ws.close()
            except Exception:
                pass


_client: SsecpClient | None = None


def get_ssecp_client() -> SsecpClient:
    global _client
    if _client is None:
        _client = SsecpClient()
    return _client
