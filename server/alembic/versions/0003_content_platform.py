"""Add content assets, editable drafts, courses and immutable versions."""
from alembic import op
import sqlalchemy as sa


revision = "0003_content_platform"
down_revision = "0002_auth_and_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "content_assets",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("asset_kind", sa.String(length=24), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=255), nullable=False, unique=True),
        sa.Column("mime_type", sa.String(length=128), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("grade", sa.String(length=32), nullable=True),
        sa.Column("theme", sa.String(length=64), nullable=True),
        sa.Column("difficulty", sa.String(length=32), nullable=True),
        sa.Column("language", sa.String(length=16), nullable=False),
        sa.Column("copyright_source", sa.String(length=255), nullable=False),
        sa.Column("usage_scope", sa.String(length=64), nullable=False),
        sa.Column("copyright_confirmed", sa.Boolean(), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("parse_error_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_content_assets_owner_id", "content_assets", ["owner_id"])
    op.create_index("ix_content_assets_sha256", "content_assets", ["sha256"])
    op.create_index("ix_content_assets_status", "content_assets", ["status"])

    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(length=96), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("current_version_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_courses_id", "courses", ["id"])
    op.create_index("ix_courses_slug", "courses", ["slug"], unique=True)
    op.create_index("ix_courses_status", "courses", ["status"])

    op.create_table(
        "course_drafts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("asset_id", sa.String(length=36), sa.ForeignKey("content_assets.id"), nullable=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=True),
        sa.Column("base_version_id", sa.Integer(), nullable=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("grade", sa.String(length=32), nullable=True),
        sa.Column("theme", sa.String(length=64), nullable=True),
        sa.Column("difficulty", sa.String(length=32), nullable=True),
        sa.Column("language", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("content_json", sa.Text(), nullable=False),
        sa.Column("validation_errors_json", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_course_drafts_id", "course_drafts", ["id"])
    op.create_index("ix_course_drafts_asset_id", "course_drafts", ["asset_id"])
    op.create_index("ix_course_drafts_course_id", "course_drafts", ["course_id"])
    op.create_index("ix_course_drafts_owner_id", "course_drafts", ["owner_id"])
    op.create_index("ix_course_drafts_status", "course_drafts", ["status"])

    op.create_table(
        "course_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_draft_id", sa.Integer(), sa.ForeignKey("course_drafts.id"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content_json", sa.Text(), nullable=False),
        sa.Column("manifest_json", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("course_id", "version_number", name="uq_course_version_number"),
    )
    op.create_index("ix_course_versions_id", "course_versions", ["id"])
    op.create_index("ix_course_versions_course_id", "course_versions", ["course_id"])


def downgrade() -> None:
    op.drop_table("course_versions")
    op.drop_table("course_drafts")
    op.drop_table("courses")
    op.drop_table("content_assets")
