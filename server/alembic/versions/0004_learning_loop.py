"""Add cloud progress, wrong-book review scheduling and assignments."""
from alembic import op
import sqlalchemy as sa


revision = "0004_learning_loop"
down_revision = "0003_content_platform"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("learning_events",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("idempotency_key", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_ref", sa.String(128), nullable=False), sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id")),
        sa.Column("course_version_id", sa.Integer(), sa.ForeignKey("course_versions.id")),
        sa.Column("client_progress_key", sa.String(128), nullable=False), sa.Column("section_id", sa.String(96), nullable=False),
        sa.Column("activity_index", sa.Integer(), nullable=False), sa.Column("activity_type", sa.String(32), nullable=False),
        sa.Column("knowledge_key", sa.String(160)), sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("correct_answer", sa.Text()), sa.Column("user_answer", sa.Text()), sa.Column("correct", sa.Boolean(), nullable=False),
        sa.Column("score_json", sa.Text()), sa.Column("occurred_at", sa.DateTime(), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_index("ix_learning_events_id", "learning_events", ["id"])
    op.create_index("ix_learning_events_idempotency_key", "learning_events", ["idempotency_key"], unique=True)
    op.create_index("ix_learning_events_user_id", "learning_events", ["user_id"])
    op.create_index("ix_learning_events_course_ref", "learning_events", ["course_ref"])

    op.create_table("learning_progress",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_ref", sa.String(128), nullable=False), sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id")),
        sa.Column("course_version_id", sa.Integer(), sa.ForeignKey("course_versions.id")), sa.Column("client_progress_key", sa.String(128), nullable=False),
        sa.Column("section_id", sa.String(96), nullable=False), sa.Column("completed_activities", sa.Integer(), nullable=False),
        sa.Column("total_activities", sa.Integer(), nullable=False), sa.Column("status", sa.String(24), nullable=False),
        sa.Column("completed_at", sa.DateTime()), sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "client_progress_key", name="uq_learning_progress_user_key"))
    for name, cols in [("ix_learning_progress_id", ["id"]), ("ix_learning_progress_user_id", ["user_id"]), ("ix_learning_progress_course_ref", ["course_ref"]), ("ix_learning_progress_status", ["status"])]: op.create_index(name, "learning_progress", cols)

    op.create_table("knowledge_points",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("canonical_key", sa.String(64), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False), sa.Column("standard_content", sa.Text(), nullable=False),
        sa.Column("correct_answer", sa.Text()), sa.Column("course_ref", sa.String(128), nullable=False),
        sa.Column("section_id", sa.String(96), nullable=False), sa.Column("tags_json", sa.Text()), sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_index("ix_knowledge_points_id", "knowledge_points", ["id"])
    op.create_index("ix_knowledge_points_canonical_key", "knowledge_points", ["canonical_key"], unique=True)
    op.create_index("ix_knowledge_points_kind", "knowledge_points", ["kind"])

    op.create_table("wrong_items",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("knowledge_point_id", sa.Integer(), sa.ForeignKey("knowledge_points.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_event_id", sa.Integer(), sa.ForeignKey("learning_events.id"), nullable=False),
        sa.Column("error_count", sa.Integer(), nullable=False), sa.Column("review_count", sa.Integer(), nullable=False),
        sa.Column("mastery_level", sa.Integer(), nullable=False), sa.Column("correct_streak", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False), sa.Column("next_review_at", sa.DateTime(), nullable=False),
        sa.Column("last_wrong_at", sa.DateTime(), nullable=False), sa.Column("last_review_at", sa.DateTime()),
        sa.Column("mastered_at", sa.DateTime()), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "knowledge_point_id", name="uq_wrong_item_user_knowledge"))
    for name, cols in [("ix_wrong_items_id", ["id"]), ("ix_wrong_items_user_id", ["user_id"]), ("ix_wrong_items_knowledge_point_id", ["knowledge_point_id"]), ("ix_wrong_items_status", ["status"]), ("ix_wrong_items_next_review_at", ["next_review_at"])]: op.create_index(name, "wrong_items", cols)

    op.create_table("review_sessions",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(24), nullable=False), sa.Column("item_ids_json", sa.Text(), nullable=False),
        sa.Column("item_count", sa.Integer(), nullable=False), sa.Column("answered_count", sa.Integer(), nullable=False),
        sa.Column("correct_count", sa.Integer(), nullable=False), sa.Column("started_at", sa.DateTime(), nullable=False), sa.Column("completed_at", sa.DateTime()))
    for name, cols in [("ix_review_sessions_id", ["id"]), ("ix_review_sessions_user_id", ["user_id"]), ("ix_review_sessions_status", ["status"])]: op.create_index(name, "review_sessions", cols)

    op.create_table("wrong_attempts",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("idempotency_key", sa.String(64), nullable=False),
        sa.Column("wrong_item_id", sa.Integer(), sa.ForeignKey("wrong_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("review_session_id", sa.Integer(), sa.ForeignKey("review_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_answer", sa.Text()), sa.Column("correct", sa.Boolean(), nullable=False), sa.Column("score_json", sa.Text()),
        sa.Column("interval_days", sa.Integer(), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False))
    for name, cols, unique in [("ix_wrong_attempts_id", ["id"], False), ("ix_wrong_attempts_idempotency_key", ["idempotency_key"], True), ("ix_wrong_attempts_wrong_item_id", ["wrong_item_id"], False), ("ix_wrong_attempts_review_session_id", ["review_session_id"], False)]: op.create_index(name, "wrong_attempts", cols, unique=unique)

    op.create_table("assignments",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("title", sa.String(255), nullable=False),
        sa.Column("course_ref", sa.String(128), nullable=False), sa.Column("section_id", sa.String(96), nullable=False),
        sa.Column("total_activities", sa.Integer(), nullable=False), sa.Column("starts_at", sa.DateTime()), sa.Column("due_at", sa.DateTime()),
        sa.Column("status", sa.String(24), nullable=False), sa.Column("instructions", sa.Text()), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False))
    for name, cols in [("ix_assignments_id", ["id"]), ("ix_assignments_teacher_id", ["teacher_id"]), ("ix_assignments_student_id", ["student_id"]), ("ix_assignments_due_at", ["due_at"]), ("ix_assignments_status", ["status"])]: op.create_index(name, "assignments", cols)

    op.create_table("assignment_progress",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("completed_activities", sa.Integer(), nullable=False), sa.Column("status", sa.String(24), nullable=False),
        sa.Column("completed_at", sa.DateTime()), sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("assignment_id", "student_id", name="uq_assignment_progress_student"))
    for name, cols in [("ix_assignment_progress_id", ["id"]), ("ix_assignment_progress_assignment_id", ["assignment_id"]), ("ix_assignment_progress_student_id", ["student_id"]), ("ix_assignment_progress_status", ["status"])]: op.create_index(name, "assignment_progress", cols)


def downgrade() -> None:
    for table in ["assignment_progress", "assignments", "wrong_attempts", "review_sessions", "wrong_items", "knowledge_points", "learning_progress", "learning_events"]:
        op.drop_table(table)
