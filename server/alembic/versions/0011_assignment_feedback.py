"""Add revisioned teacher feedback and student responses for assignments."""
from alembic import op
import sqlalchemy as sa


revision = "0011_assignment_feedback"
down_revision = "0010_parent_controls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("student_learning_policies", sa.Column("is_configured", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table(
        "assignment_feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("encouragement_tag", sa.String(32)),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("student_response", sa.String(500)),
        sa.Column("responded_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("assignment_id", name="uq_assignment_feedback_assignment"),
    )
    op.create_index("ix_assignment_feedback_id", "assignment_feedback", ["id"])
    op.create_index("ix_assignment_feedback_assignment_id", "assignment_feedback", ["assignment_id"])
    op.create_index("ix_assignment_feedback_teacher_id", "assignment_feedback", ["teacher_id"])
    op.create_index("ix_assignment_feedback_student_id", "assignment_feedback", ["student_id"])


def downgrade() -> None:
    op.drop_table("assignment_feedback")
    op.drop_column("student_learning_policies", "is_configured")
