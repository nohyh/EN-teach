"""Add teacher classrooms, parent preferences and auditable operations."""
from alembic import op
import sqlalchemy as sa


revision = "0007_teacher_parent_ops"
down_revision = "0006_stage3_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "classrooms",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("invite_code", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    for name, columns, unique in [
        ("ix_classrooms_id", ["id"], False),
        ("ix_classrooms_teacher_id", ["teacher_id"], False),
        ("ix_classrooms_invite_code", ["invite_code"], True),
        ("ix_classrooms_status", ["status"], False),
    ]:
        op.create_index(name, "classrooms", columns, unique=unique)

    op.create_table(
        "class_memberships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("classroom_id", sa.Integer(), sa.ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("joined_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("classroom_id", "student_id", name="uq_class_membership_student"),
    )
    for name, columns in [
        ("ix_class_memberships_id", ["id"]),
        ("ix_class_memberships_classroom_id", ["classroom_id"]),
        ("ix_class_memberships_student_id", ["student_id"]),
        ("ix_class_memberships_status", ["status"]),
    ]:
        op.create_index(name, "class_memberships", columns)

    op.create_table(
        "notification_preferences",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("weekly_report", sa.Boolean(), nullable=False),
        sa.Column("assignment_due", sa.Boolean(), nullable=False),
        sa.Column("review_due", sa.Boolean(), nullable=False),
        sa.Column("streak_reminder", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("target_type", sa.String(32), nullable=False),
        sa.Column("target_id", sa.String(128), nullable=False),
        sa.Column("reason", sa.String(500)),
        sa.Column("detail_json", sa.Text()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    for name, columns in [
        ("ix_audit_logs_id", ["id"]),
        ("ix_audit_logs_actor_id", ["actor_id"]),
        ("ix_audit_logs_action", ["action"]),
        ("ix_audit_logs_target_type", ["target_type"]),
        ("ix_audit_logs_created_at", ["created_at"]),
    ]:
        op.create_index(name, "audit_logs", columns)


def downgrade() -> None:
    for table in ["audit_logs", "notification_preferences", "class_memberships", "classrooms"]:
        op.drop_table(table)
