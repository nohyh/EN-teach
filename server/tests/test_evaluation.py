"""口语评测服务测试: Mock 评估器 + SSECP 结果解析 (纯逻辑, 不触网)"""
from app.services.evaluation_service import MockEvaluator, _parse_ssecp_result


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
