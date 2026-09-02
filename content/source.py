from dataclasses import dataclass
from pathlib import Path


@dataclass
class ContentSource:
    path: Path

    @property
    def filename(self) -> str:
        return self.path.name

    @property
    def format(self) -> str:
        return self.path.suffix.lstrip(".").lower()

    def read_text(self) -> str:
        return self.path.read_text(encoding="utf-8")
