"""Add versioned assignment batches and in-app notification delivery."""
from alembic import op
import sqlalchemy as sa


revision = "0009_batches_notifications"
down_revision = "0008_stage4_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assignment_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("classroom_id", sa.Integer(), sa.ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("course_ref", sa.String(128), nullable=False),
        sa.Column("section_id", sa.String(96), nullable=False),
        sa.Column("total_activities", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime()),
        sa.Column("due_at", sa.DateTime()),
        sa.Column("allow_late", sa.Boolean(), nullable=False),
        sa.Column("instructions", sa.Text()),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    for name, columns in [
        ("ix_assignment_batches_id", ["id"]),
        ("ix_assignment_batches_classroom_id", ["classroom_id"]),
        ("ix_assignment_batches_teacher_id", ["teacher_id"]),
        ("ix_assignment_batches_due_at", ["due_at"]),
        ("ix_assignment_batches_status", ["status"]),
    ]:
        op.create_index(name, "assignment_batches", columns)

    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("assignments") as batch:
            batch.add_column(sa.Column("batch_id", sa.Integer(), nullable=True))
            batch.create_foreign_key(
                "assignments_batch_id_fkey", "assignment_batches", ["batch_id"], ["id"], ondelete="SET NULL",
            )
            batch.create_index("ix_assignments_batch_id", ["batch_id"])
    else:
        op.add_column("assignments", sa.Column("batch_id", sa.Integer(), sa.ForeignKey("assignment_batches.id", ondelete="SET NULL"), nullable=True))
        op.create_index("ix_assignments_batch_id", "assignments", ["batch_id"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("channel", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("dedupe_key", sa.String(180), nullable=False),
        sa.Column("detail_json", sa.Text()),
        sa.Column("delivered_at", sa.DateTime(), nullable=False),
        sa.Column("read_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    for name, columns, unique in [
        ("ix_notifications_id", ["id"], False),
        ("ix_notifications_user_id", ["user_id"], False),
        ("ix_notifications_type", ["type"], False),
        ("ix_notifications_status", ["status"], False),
        ("ix_notifications_dedupe_key", ["dedupe_key"], True),
        ("ix_notifications_read_at", ["read_at"], False),
        ("ix_notifications_created_at", ["created_at"], False),
    ]:
        op.create_index(name, "notifications", columns, unique=unique)


def downgrade() -> None:
    op.drop_table("notifications")
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("assignments") as batch:
            batch.drop_index("ix_assignments_batch_id")
            batch.drop_constraint("assignments_batch_id_fkey", type_="foreignkey")
            batch.drop_column("batch_id")
    else:
        op.drop_index("ix_assignments_batch_id", table_name="assignments")
        op.drop_column("assignments", "batch_id")
    op.drop_table("assignment_batches")
