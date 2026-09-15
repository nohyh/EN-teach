"""Add real user credentials and revocable refresh sessions."""
from alembic import op
import sqlalchemy as sa


revision = "0002_auth_and_sessions"
down_revision = "0001_legacy_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "username" not in user_columns:
        op.add_column("users", sa.Column("username", sa.String(length=64), nullable=True))
    if "password_hash" not in user_columns:
        op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
    if "is_active" not in user_columns:
        op.add_column("users", sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False))
    if "updated_at" not in user_columns:
        op.add_column("users", sa.Column("updated_at", sa.DateTime(), nullable=True))

    users = sa.table(
        "users",
        sa.column("id", sa.Integer),
        sa.column("username", sa.String),
        sa.column("password_hash", sa.String),
        sa.column("role", sa.String),
        sa.column("created_at", sa.DateTime),
        sa.column("updated_at", sa.DateTime),
    )
    op.execute(
        users.update()
        .where(users.c.username.is_(None))
        .values(username=sa.literal("legacy-") + sa.cast(users.c.id, sa.String()))
    )
    op.execute(
        users.update()
        .where(users.c.password_hash.is_(None))
        .values(password_hash="!password-reset-required")
    )
    op.execute(
        users.update()
        .where(users.c.updated_at.is_(None))
        .values(updated_at=sa.func.coalesce(users.c.created_at, sa.func.current_timestamp()))
    )
    op.execute(users.update().where(users.c.role == "child").values(role="student"))

    user_indexes = {index["name"] for index in inspector.get_indexes("users")}
    with op.batch_alter_table("users") as batch:
        batch.alter_column("username", existing_type=sa.String(length=64), nullable=False)
        batch.alter_column("password_hash", existing_type=sa.String(length=255), nullable=False)
        batch.alter_column("updated_at", existing_type=sa.DateTime(), nullable=False)
        if "ix_users_username" not in user_indexes:
            batch.create_index("ix_users_username", ["username"], unique=True)

    inspector = sa.inspect(op.get_bind())
    if "auth_sessions" not in inspector.get_table_names():
        op.create_table(
            "auth_sessions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("jti", sa.String(length=64), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )

    inspector = sa.inspect(op.get_bind())
    session_indexes = {index["name"] for index in inspector.get_indexes("auth_sessions")}
    for index_name, columns, unique in (
        ("ix_auth_sessions_id", ["id"], False),
        ("ix_auth_sessions_user_id", ["user_id"], False),
        ("ix_auth_sessions_jti", ["jti"], True),
        ("ix_auth_sessions_expires_at", ["expires_at"], False),
    ):
        if index_name not in session_indexes:
            op.create_index(index_name, "auth_sessions", columns, unique=unique)


def downgrade() -> None:
    op.drop_table("auth_sessions")
    with op.batch_alter_table("users") as batch:
        batch.drop_index("ix_users_username")
        batch.drop_column("updated_at")
        batch.drop_column("is_active")
        batch.drop_column("password_hash")
        batch.drop_column("username")
