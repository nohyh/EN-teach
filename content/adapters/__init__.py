from .base import ContentAdapter, AdapterRegistry, UnsupportedFormatError
from . import markdown  # noqa: F401  注册副作用
from . import json_adapter  # noqa: F401

__all__ = ["ContentAdapter", "AdapterRegistry", "UnsupportedFormatError"]
