from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Sentence:
    id: str
    unit_id: str
    text: str
    translation: Optional[str] = None
    audio_url: Optional[str] = None
    order: int = 0
    source: str = "sentences"


@dataclass
class Unit:
    id: str
    name: str
    description: Optional[str] = None
    order: int = 0
    sentences: list[Sentence] = field(default_factory=list)
