"""
Markdown 教材适配器

参考样本: dd.md

约定结构:
  # Unit <number> <title>      <- 单元起始边界
  ## Words / Sentences / Dialogue / Key Sentences / ...
  **句子**                     <- 下一行是中文翻译
  Name: 台词                   <- 对话行

特性:
  - 同一 Unit 内重复句子自动去重(保留首次出现)
  - 没有 ## 段标题的子块(例如 # Speaking Practice)会作为对话源兜底抽取
"""
import re
from ..schemas import Sentence, Unit
from ..source import ContentSource
from .base import AdapterRegistry, ContentAdapter


class MarkdownAdapter:

    @classmethod
    def format_name(cls) -> str:
        return "markdown"

    @classmethod
    def can_handle(cls, source: ContentSource) -> bool:
        return source.format in ("md", "markdown")

    @classmethod
    def parse(cls, source: ContentSource) -> list[Unit]:
        return cls._parse(source.read_text())

    @classmethod
    def _parse(cls, text: str) -> list[Unit]:
        chunks = re.split(r"(?=^#\s+Unit\s+\d+)", text, flags=re.MULTILINE)
        chunks = [c.strip() for c in chunks if c.strip()]

        units: list[Unit] = []
        for idx, chunk in enumerate(chunks, start=1):
            head = re.match(r"^#\s+(Unit\s+\d+.*)$", chunk, re.MULTILINE)
            if not head:
                continue
            unit_name = head.group(1).strip()
            unit = Unit(
                id=cls._slugify(unit_name),
                name=unit_name,
                order=idx,
                sentences=[],
            )
            seen: set[str] = set()

            for sub in re.split(r"\n---\n", chunk)[1:]:
                sub = sub.strip()
                if not sub:
                    continue
                cls._harvest_subblock(unit, sub, seen)

            units.append(unit)
        return units

    # ---------- per-subblock dispatch ----------

    @classmethod
    def _harvest_subblock(cls, unit: Unit, sub: str, seen: set[str]):
        sections = list(cls._iter_sections(sub))
        if sections:
            for name, body in sections:
                kind = cls._classify_section(name)
                if kind == "sentences":
                    cls._collect_bold_pairs(unit, body, "sentences", seen)
                elif kind == "dialogue":
                    cls._collect_dialogue(unit, body, "dialogue", seen)
            return
        cls._collect_dialogue(unit, sub, "dialogue", seen)

    # ---------- section iteration ----------

    @staticmethod
    def _iter_sections(chunk: str):
        pattern = re.compile(
            r"^##\s+(.+?)\s*$([\s\S]*?)(?=^##\s+|^---\s*$|\Z)",
            re.MULTILINE,
        )
        for m in pattern.finditer(chunk):
            yield m.group(1).strip(), m.group(2).strip()

    @staticmethod
    def _classify_section(name: str) -> str | None:
        n = name.lower()
        if "sentence" in n:
            return "sentences"
        if "dialogue" in n or "对话" in name:
            return "dialogue"
        return None

    # ---------- extractors ----------

    @classmethod
    def _collect_bold_pairs(cls, unit: Unit, body: str, source: str, seen: set[str]):
        lines = [ln.rstrip() for ln in body.splitlines()]
        i = 0
        while i < len(lines):
            m = re.match(r"^\*\*(.+)\*\*\s*$", lines[i].strip())
            if not m:
                i += 1
                continue
            text = m.group(1).strip()
            translation: str | None = None
            if i + 1 < len(lines):
                nxt = lines[i + 1].strip()
                if nxt and not nxt.startswith("**") and not nxt.startswith("#"):
                    translation = nxt
                    i += 2
                    cls._append(unit, text, translation, source, seen)
                    continue
            i += 1
            cls._append(unit, text, None, source, seen)

    @classmethod
    def _collect_dialogue(cls, unit: Unit, body: str, source: str, seen: set[str]):
        for raw in body.splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            spoken = cls._extract_spoken(line)
            if spoken:
                cls._append(unit, spoken, None, source, seen)

    @staticmethod
    def _extract_spoken(line: str) -> str | None:
        for sep in (":", "："):
            if sep in line:
                name, _, tail = line.partition(sep)
                if name.strip().startswith("**"):
                    return None
                tail = tail.strip()
                return tail or None
        return None

    # ---------- append with dedup ----------

    @staticmethod
    def _append(unit: Unit, text: str, translation: str | None, source: str, seen: set[str]):
        norm = text.strip().lower()
        if not norm or norm in seen:
            return
        seen.add(norm)
        order = len(unit.sentences) + 1
        unit.sentences.append(
            Sentence(
                id=f"{unit.id}-sent-{order}",
                unit_id=unit.id,
                text=text,
                translation=translation,
                order=order,
                source=source,
            )
        )

    # ---------- utils ----------

    @staticmethod
    def _slugify(text: str) -> str:
        s = re.sub(r"[^\w\s-]", "", text.lower())
        s = re.sub(r"[\s_-]+", "-", s).strip("-")
        return s or "unit"


AdapterRegistry.register(MarkdownAdapter)
