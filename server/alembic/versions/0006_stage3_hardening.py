"""Synchronize PostgreSQL sequences after seeded rows with explicit IDs."""
from alembic import op
import sqlalchemy as sa


revision = "0006_stage3_hardening"
down_revision = "0005_economy_growth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text(
            "SELECT setval(pg_get_serial_sequence('store_items', 'id'), "
            "COALESCE((SELECT MAX(id) FROM store_items), 1), "
            "EXISTS (SELECT 1 FROM store_items))"
        ))


def downgrade() -> None:
    # Sequence synchronization preserves correctness across rollbacks and must
    # not move the counter backwards into already-issued primary keys.
    pass
