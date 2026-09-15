"""Synchronize the PostgreSQL user sequence after legacy fixed-ID demo users."""
from alembic import op
import sqlalchemy as sa


revision = "0008_stage4_hardening"
down_revision = "0007_teacher_parent_ops"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text(
            "SELECT setval(pg_get_serial_sequence('users', 'id'), "
            "COALESCE((SELECT MAX(id) FROM users), 1), "
            "EXISTS (SELECT 1 FROM users))"
        ))


def downgrade() -> None:
    # Never move a sequence backwards into already-issued identifiers.
    pass
