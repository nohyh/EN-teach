"""Add retryable notification delivery outbox."""
from alembic import op
import sqlalchemy as sa


revision = "0012_notification_outbox"
down_revision = "0011_assignment_feedback"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_outbox",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("notification_id", sa.Integer(), sa.ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(), nullable=False),
        sa.Column("locked_at", sa.DateTime()),
        sa.Column("last_error", sa.String(500)),
        sa.Column("provider_message_id", sa.String(160)),
        sa.Column("idempotency_key", sa.String(220), nullable=False),
        sa.Column("sent_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    for name, columns, unique in [
        ("ix_notification_outbox_id", ["id"], False),
        ("ix_notification_outbox_notification_id", ["notification_id"], False),
        ("ix_notification_outbox_channel", ["channel"], False),
        ("ix_notification_outbox_status", ["status"], False),
        ("ix_notification_outbox_next_attempt_at", ["next_attempt_at"], False),
        ("ix_notification_outbox_idempotency_key", ["idempotency_key"], True),
    ]:
        op.create_index(name, "notification_outbox", columns, unique=unique)


def downgrade() -> None:
    op.drop_table("notification_outbox")
