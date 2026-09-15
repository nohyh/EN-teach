"""内容资产存储抽象；本地开发使用文件系统，生产可替换为 S3/OSS。"""
from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from app.core.config import get_settings


class LocalContentStorage:
    def __init__(self) -> None:
        self.root = Path(get_settings().content_storage_dir).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, payload: bytes, suffix: str) -> str:
        safe_suffix = suffix.lower() if suffix.startswith(".") and suffix[1:].isalnum() else ""
        key = f"{uuid4().hex[:2]}/{uuid4().hex}{safe_suffix}"
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise ValueError("非法存储路径")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)
        return key

    def read(self, key: str) -> bytes:
        path = (self.root / key).resolve()
        if self.root not in path.parents or not path.is_file():
            raise FileNotFoundError("内容资产不存在")
        return path.read_bytes()


_storage: LocalContentStorage | None = None


def get_content_storage() -> LocalContentStorage:
    global _storage
    if _storage is None:
        _storage = LocalContentStorage()
    return _storage
