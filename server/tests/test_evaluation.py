"""口语评测服务测试: Mock 评估器 + SSECP 协议/结果解析 (纯逻辑, 不触网)"""
import json

from app.services.evaluation_service import MockEvaluator, _parse_ssecp_result
from app.services.ssecp_client import SsecpClient, Warrant


def test_mock_evaluator_scores_and_words():
    m = MockEvaluator()
    r = m.evaluate(b"fake-audio" * 100, "Hello, I am Amy.")

    assert 0 <= r.overall <= 100
    assert 0 <= r.accuracy <= 100
    assert 0 <= r.fluency <= 100
    assert r.words, "mock 应把 ref_text 拆成单词打分"
    # 注: Mock 分词只剥 "?!/.", 逗号保留 -> "Hello," 是一个 token
    assert {w.text for w in r.words} == {"Hello,", "I", "am", "Amy"}
    assert r.to_dict()["overall"] == r.overall


def test_mock_passed_uses_threshold():
    m = MockEvaluator()
    r = m.evaluate(b"x" * 8000, "apple")
    assert r.passed is (r.overall >= 90.0)


def test_parse_ssecp_result_full():
    raw = {
        "result": {
            "overall": 76,
            "accuracy": 73,
            "fluency": {"overall": 94, "pause": 0, "speed": 1},
            "integrity": 100,
            "details": [
                {
                    "char": "apple",
                    "score": 90,
                    "phone": [{"char": "ae", "score": 100}, {"char": "p", "score": 88}],
                }
            ],
        }
    }
    r = _parse_ssecp_result(raw, "apple")

    assert r.overall == 76.0
    assert r.accuracy == 73.0
    assert r.fluency == 94.0
    assert r.integrity == 100.0
    assert len(r.words) == 1
    assert r.words[0].text == "apple"
    assert [p.char for p in r.words[0].phonemes] == ["ae", "p"]


def test_parse_ssecp_result_empty():
    r = _parse_ssecp_result({"result": {}}, "")
    assert r.overall == 0.0
    assert r.words == []


def test_ssecp_websocket_packets_use_official_sig_field(monkeypatch):
    class FakeWebSocket:
        def __init__(self):
            self.text_packets = []
            self.binary_packets = []

        def send(self, value):
            self.text_packets.append(json.loads(value))

        def send_binary(self, value):
            self.binary_packets.append(value)

        def settimeout(self, _value):
            pass

        def recv(self):
            return json.dumps({"result": {"overall": 88}, "eof": 1})

        def close(self):
            pass

    fake_ws = FakeWebSocket()
    monkeypatch.setattr(
        "app.services.ssecp_client.websocket.create_connection",
        lambda *_args, **_kwargs: fake_ws,
    )

    client = object.__new__(SsecpClient)
    client.app_id = "test-app"
    client.app_secret = "test-secret"
    result = client._ws_evaluate(
        ws_url="wss://example.invalid",
        warrant=Warrant("test-warrant", 9999999999),
        connect_id="connect-id",
        token_id="token-id",
        request_id="request-id",
        ts_connect=100,
        ts_start=101,
        user_id="student-1",
        ref_text="apple",
        core_type="en.sent_kid.score",
        audio_type="pcm",
        sample_rate=16000,
        output_phones=True,
        audio_bytes=b"\x00\x00" * 100,
        timeout=1,
    )

    connect_app = fake_ws.text_packets[0]["param"]["app"]
    start_app = fake_ws.text_packets[1]["param"]["app"]
    assert "sig" in connect_app and "signature" not in connect_app
    assert "sig" in start_app and "signature" not in start_app
    assert fake_ws.text_packets[1]["param"]["audio"]["audioType"] == "pcm"
    assert fake_ws.binary_packets
    assert result["result"]["overall"] == 88
