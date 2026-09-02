from typing import Protocol, runtime_checkable
from ..schemas import Unit
from ..source import ContentSource


@runtime_checkable
class ContentAdapter(Protocol):
    @classmethod
    def format_name(cls) -> str: ...

    @classmethod
    def can_handle(cls, source: ContentSource) -> bool: ...

    @classmethod
    def parse(cls, source: ContentSource) -> list[Unit]: ...


class UnsupportedFormatError(Exception):
    pass


class AdapterRegistry:
    _adapters: list[type] = []

    @classmethod
    def register(cls, adapter: type):
        if adapter not in cls._adapters:
            cls._adapters.append(adapter)

    @classmethod
    def supported_formats(cls) -> list[str]:
        return [a.format_name() for a in cls._adapters]

    @classmethod
    def resolve(cls, source: ContentSource) -> type:
        for adapter in cls._adapters:
            if adapter.can_handle(source):
                return adapter
        raise UnsupportedFormatError(
            f"No adapter for format '{source.format}'. "
            f"Supported: {cls.supported_formats()}"
        )

    @classmethod
    def parse(cls, source: ContentSource) -> list[Unit]:
        return cls.resolve(source).parse(source)
