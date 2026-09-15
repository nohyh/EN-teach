"""Retryable notification outbox processor with swappable channel adapters."""
from __future__ import annotations

from datetime import timedelta
from typing import Protocol

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Notification, NotificationOutbox, utcnow


class DeliveryError(RuntimeError):
    pass


class DeliveryAdapter(Protocol):
    def send(self, notification: Notification, outbox: NotificationOutbox) -> str: ...


class MockDeliveryAdapter:
    def send(self, notification: Notification, outbox: NotificationOutbox) -> str:
        return f"mock-{outbox.id}-{notification.id}"


class UnconfiguredAdapter:
    def __init__(self, channel: str):
        self.channel = channel

    def send(self, notification: Notification, outbox: NotificationOutbox) -> str:
        raise DeliveryError(f"{self.channel} 发送器尚未配置生产凭据")


def adapters() -> dict[str, DeliveryAdapter]:
    return {
        "mock": MockDeliveryAdapter(),
        "email": UnconfiguredAdapter("email"),
        "apns": UnconfiguredAdapter("apns"),
    }


def process_outbox(
    db: Session,
    *,
    limit: int = 100,
    adapter_map: dict[str, DeliveryAdapter] | None = None,
) -> dict[str, int]:
    settings = get_settings()
    now = utcnow()
    rows = db.query(NotificationOutbox).filter(
        NotificationOutbox.status.in_(["pending", "failed"]),
        NotificationOutbox.next_attempt_at <= now,
        NotificationOutbox.attempt_count < NotificationOutbox.max_attempts,
    ).order_by(NotificationOutbox.id).limit(limit).with_for_update(skip_locked=True).all()
    available = adapter_map or adapters()
    result = {"processed": 0, "sent": 0, "failed": 0, "dead": 0}
    for row in rows:
        notification = db.get(Notification, row.notification_id)
        row.locked_at = now
        row.attempt_count += 1
        result["processed"] += 1
        try:
            if not notification:
                raise DeliveryError("站内通知已不存在")
            adapter = available.get(row.channel)
            if not adapter:
                raise DeliveryError(f"不支持的通知通道：{row.channel}")
            row.provider_message_id = adapter.send(notification, row)
            row.status = "sent"
            row.sent_at = utcnow()
            row.last_error = None
            result["sent"] += 1
        except Exception as error:
            row.last_error = str(error)[:500]
            if row.attempt_count >= row.max_attempts:
                row.status = "dead"
                result["dead"] += 1
            else:
                row.status = "failed"
                delay = settings.notification_retry_base_seconds * (2 ** (row.attempt_count - 1))
                row.next_attempt_at = now + timedelta(seconds=min(delay, 86400))
                result["failed"] += 1
        finally:
            row.locked_at = None
            row.updated_at = utcnow()
    return result


def retry_outbox(db: Session, row: NotificationOutbox) -> None:
    row.status = "pending"
    row.attempt_count = 0
    row.next_attempt_at = utcnow()
    row.locked_at = None
    row.last_error = None
    row.provider_message_id = None
    row.sent_at = None
    row.updated_at = utcnow()
