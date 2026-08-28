"""
JSON 教材适配器

甲方 JSON 期望格式 (未定, 这是占位约定):
{
  "units": [
    {
      "name": "Unit 1 Hello",
      "description": "问候与自我介绍",
      "sentences": [
        {"text": "Hello!", "translation": "你好"},
        {"text": "I'm Amy.", "translation": "我是 Amy"}
      ]
    }
  ]
}

甲方实际格式与本约定不一致时, 写一个新 adapter, 不要改这里。
"""
import json
from ..schemas import Sentence, Unit
from ..source import ContentSource
from .base import AdapterRegistry, ContentAdapter


class JsonAdapter:

    @classmethod
    def format_name(cls) -> str:
        return "json"

    @classmethod
    def can_handle(cls, source: ContentSource) -> bool:
        return source.format == "json"

    @classmethod
    def parse(cls, source: ContentSource) -> list[Unit]:
        raw = json.loads(source.read_text())
        units_raw = raw.get("units") or raw.get("data") or []
        units: list[Unit] = []
        for idx, u in enumerate(units_raw, start=1):
            unit = Unit(
                id=_slugify(u.get("name") or u.get("id") or f"unit-{idx}"),
                name=u.get("name") or f"Unit {idx}",
                description=u.get("description"),
                order=idx,
                sentences=[],
            )
            for j, s in enumerate(u.get("sentences", []), start=1):
                unit.sentences.append(
                    Sentence(
                        id=f"{unit.id}-sent-{j}",
                        unit_id=unit.id,
                        text=s["text"],
                        translation=s.get("translation"),
                        order=j,
                        source="sentences",
                    )
                )
            units.append(unit)
        return units


def _slugify(text: str) -> str:
    import re
    s = re.sub(r"[^\w\s-]", "", text.lower())
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return s or "unit"


AdapterRegistry.register(JsonAdapter)
