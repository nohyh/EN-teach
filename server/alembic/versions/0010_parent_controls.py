"""Add parent-managed learning policies and idempotent daily usage tracking."""
from alembic import op
import sqlalchemy as sa


revision = "0010_parent_controls"
down_revision = "0009_batches_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "student_learning_policies",
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("learning_enabled", sa.Boolean(), nullable=False),
        sa.Column("daily_limit_minutes", sa.Integer(), nullable=False),
        sa.Column("allowed_start", sa.String(5), nullable=False),
        sa.Column("allowed_end", sa.String(5), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("voice_enabled", sa.Boolean(), nullable=False),
        sa.Column("ai_enabled", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("daily_limit_minutes BETWEEN 5 AND 240", name="ck_learning_policy_daily_limit"),
    )
    op.create_index("ix_student_learning_policies_parent_id", "student_learning_policies", ["parent_id"])

    op.create_table(
        "daily_learning_usage",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("active_seconds", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("active_seconds >= 0", name="ck_daily_learning_usage_nonnegative"),
        sa.UniqueConstraint("student_id", "usage_date", name="uq_daily_learning_usage_student_date"),
    )
    op.create_index("ix_daily_learning_usage_id", "daily_learning_usage", ["id"])
    op.create_index("ix_daily_learning_usage_student_id", "daily_learning_usage", ["student_id"])
    op.create_index("ix_daily_learning_usage_usage_date", "daily_learning_usage", ["usage_date"])

    op.create_table(
        "learning_usage_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("idempotency_key", sa.String(96), nullable=False),
        sa.Column("active_seconds", sa.Integer(), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_learning_usage_events_id", "learning_usage_events", ["id"])
    op.create_index("ix_learning_usage_events_student_id", "learning_usage_events", ["student_id"])
    op.create_index("ix_learning_usage_events_idempotency_key", "learning_usage_events", ["idempotency_key"], unique=True)
    op.create_index("ix_learning_usage_events_usage_date", "learning_usage_events", ["usage_date"])


def downgrade() -> None:
    op.drop_table("learning_usage_events")
    op.drop_table("daily_learning_usage")
    op.drop_table("student_learning_policies")
