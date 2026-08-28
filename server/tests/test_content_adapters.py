"""内容适配器测试: dd.md -> Unit/Sentence 解析"""
from pathlib import Path

import content.adapters  # noqa: F401  触发适配器注册
from content.adapters.base import AdapterRegistry
from content.source import ContentSource

ROOT = Path(__file__).resolve().parent.parent.parent


def test_supported_formats():
    assert "markdown" in AdapterRegistry.supported_formats()


def test_parse_dd_md_units():
    src = ContentSource(path=ROOT / "dd.md")
    units = AdapterRegistry.parse(src)

    assert len(units) == 1
    unit = units[0]
    assert unit.id == "unit-1-hello"
    assert unit.name == "Unit 1 Hello!"
    assert len(unit.sentences) == 18, "dd.md 应抽出 18 句 (与 seed 结果一致)"

    for s in unit.sentences:
        assert s.text, "句子必须有文本"
        assert s.id.startswith("unit-1-hello-sent-"), "句子 id 需按约定命名"


def test_parse_dd_md_dedup():
    """同一 Unit 内重复句子去重 (Words 和 Dialogue 都含 Hello!/Hi!)"""
    src = ContentSource(path=ROOT / "dd.md")
    units = AdapterRegistry.parse(src)
    texts = [s.text for s in units[0].sentences]
    assert len(texts) == len(set(texts)), "重复句子应被去重"
