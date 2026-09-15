"""Notification outbox retry and terminal failure behavior."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base
from app.db.models import Notification, NotificationOutbox, User, utcnow
from app.services import notification_delivery, notifications


class FailingAdapter:
    def send(self, notification, outbox):
        raise notification_delivery.DeliveryError("模拟通道故障")


def test_outbox_retries_idempotently_and_moves_to_dead():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add(User(id=1, username="student", password_hash="!", role="student", name="Student"))
        db.flush()
        notification, created = notifications.deliver(
            db, user_id=1, notification_type="test", title="测试通知", body="测试",
            dedupe_key="outbox-test-notification",
        )
        assert created is True
        same, duplicate_created = notifications.deliver(
            db, user_id=1, notification_type="test", title="测试通知", body="测试",
            dedupe_key="outbox-test-notification",
        )
        assert same.id == notification.id and duplicate_created is False
        assert db.query(NotificationOutbox).count() == 1
        row = db.query(NotificationOutbox).one()
        row.max_attempts = 2

        first = notification_delivery.process_outbox(db, adapter_map={"mock": FailingAdapter()})
        assert first == {"processed": 1, "sent": 0, "failed": 1, "dead": 0}
        row.next_attempt_at = utcnow()
        second = notification_delivery.process_outbox(db, adapter_map={"mock": FailingAdapter()})
        assert second == {"processed": 1, "sent": 0, "failed": 0, "dead": 1}
        assert row.status == "dead" and row.attempt_count == 2 and "模拟通道故障" in row.last_error

        notification_delivery.retry_outbox(db, row)
        recovered = notification_delivery.process_outbox(db)
        assert recovered["sent"] == 1
        assert row.status == "sent" and row.provider_message_id.startswith("mock-")
