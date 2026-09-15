"""Add auditable points, store inventory and growth badges."""
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision = "0005_economy_growth"
down_revision = "0004_learning_loop"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("points_accounts",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("balance", sa.Integer(), nullable=False), sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("balance >= 0", name="ck_points_account_nonnegative"))
    op.create_table("reward_rules",
        sa.Column("code", sa.String(64), primary_key=True), sa.Column("event_type", sa.String(32), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False), sa.Column("daily_limit", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False), sa.Column("description", sa.String(255)),
        sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False))
    op.create_index("ix_reward_rules_event_type", "reward_rules", ["event_type"])
    op.create_index("ix_reward_rules_status", "reward_rules", ["status"])
    op.create_table("store_items",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("slug", sa.String(96), nullable=False),
        sa.Column("name", sa.String(128), nullable=False), sa.Column("description", sa.Text()),
        sa.Column("category", sa.String(32), nullable=False), sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False), sa.Column("asset_url", sa.String(512)),
        sa.Column("preview", sa.String(32)), sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False), sa.CheckConstraint("price >= 0", name="ck_store_item_price"))
    op.create_index("ix_store_items_id", "store_items", ["id"])
    op.create_index("ix_store_items_slug", "store_items", ["slug"], unique=True)
    op.create_index("ix_store_items_category", "store_items", ["category"])
    op.create_index("ix_store_items_status", "store_items", ["status"])
    op.create_table("badge_definitions",
        sa.Column("code", sa.String(64), primary_key=True), sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.String(255), nullable=False), sa.Column("icon", sa.String(16), nullable=False),
        sa.Column("criteria_type", sa.String(32), nullable=False), sa.Column("threshold", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False))
    op.create_index("ix_badge_definitions_criteria_type", "badge_definitions", ["criteria_type"])
    op.create_index("ix_badge_definitions_status", "badge_definitions", ["status"])
    op.create_table("points_transactions",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False), sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(32), nullable=False), sa.Column("reason", sa.String(64), nullable=False),
        sa.Column("source_id", sa.String(128), nullable=False), sa.Column("idempotency_key", sa.String(160), nullable=False),
        sa.Column("detail_json", sa.Text()), sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("balance_after >= 0", name="ck_points_transaction_balance"))
    for name, columns, unique in [
        ("ix_points_transactions_id", ["id"], False), ("ix_points_transactions_user_id", ["user_id"], False),
        ("ix_points_transactions_type", ["type"], False), ("ix_points_transactions_reason", ["reason"], False),
        ("ix_points_transactions_idempotency_key", ["idempotency_key"], True), ("ix_points_transactions_created_at", ["created_at"], False),
    ]: op.create_index(name, "points_transactions", columns, unique=unique)
    op.create_table("purchases",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("store_items.id"), nullable=False), sa.Column("price_paid", sa.Integer(), nullable=False),
        sa.Column("idempotency_key", sa.String(160), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "item_id", name="uq_purchase_user_item"))
    for name, columns, unique in [("ix_purchases_id", ["id"], False), ("ix_purchases_user_id", ["user_id"], False), ("ix_purchases_item_id", ["item_id"], False), ("ix_purchases_idempotency_key", ["idempotency_key"], True)]: op.create_index(name, "purchases", columns, unique=unique)
    op.create_table("user_assets",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("store_items.id"), nullable=False), sa.Column("equipped", sa.Boolean(), nullable=False),
        sa.Column("acquired_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "item_id", name="uq_user_asset_item"))
    for name, columns in [("ix_user_assets_id", ["id"]), ("ix_user_assets_user_id", ["user_id"]), ("ix_user_assets_item_id", ["item_id"]), ("ix_user_assets_equipped", ["equipped"])]: op.create_index(name, "user_assets", columns)
    op.create_table("user_badges",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("badge_code", sa.String(64), sa.ForeignKey("badge_definitions.code"), nullable=False),
        sa.Column("source_value", sa.Integer(), nullable=False), sa.Column("awarded_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "badge_code", name="uq_user_badge_code"))
    for name, columns in [("ix_user_badges_id", ["id"]), ("ix_user_badges_user_id", ["user_id"]), ("ix_user_badges_badge_code", ["badge_code"])]: op.create_index(name, "user_badges", columns)

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    accounts = sa.table("points_accounts", sa.column("user_id"), sa.column("balance"), sa.column("version"), sa.column("created_at"), sa.column("updated_at"))
    users = sa.table("users", sa.column("id"))
    op.execute(accounts.insert().from_select(
        ["user_id", "balance", "version", "created_at", "updated_at"],
        sa.select(users.c.id, sa.literal(0), sa.literal(0), sa.literal(now), sa.literal(now)),
    ))
    rules = sa.table("reward_rules", sa.column("code"), sa.column("event_type"), sa.column("points"), sa.column("daily_limit"), sa.column("status"), sa.column("description"), sa.column("created_at"), sa.column("updated_at"))
    op.bulk_insert(rules, [
        {"code": "activity_correct", "event_type": "learning", "points": 2, "daily_limit": 60, "status": "active", "description": "答对学习活动", "created_at": now, "updated_at": now},
        {"code": "lesson_complete", "event_type": "learning", "points": 20, "daily_limit": 100, "status": "active", "description": "完成课程", "created_at": now, "updated_at": now},
        {"code": "first_perfect", "event_type": "learning", "points": 10, "daily_limit": 50, "status": "active", "description": "首次满分完成", "created_at": now, "updated_at": now},
        {"code": "wrong_item_mastered", "event_type": "review", "points": 8, "daily_limit": 80, "status": "active", "description": "掌握错题", "created_at": now, "updated_at": now},
        {"code": "badge_unlock", "event_type": "growth", "points": 5, "daily_limit": 50, "status": "active", "description": "解锁成长徽章", "created_at": now, "updated_at": now},
    ])
    items = sa.table("store_items", sa.column("id"), sa.column("slug"), sa.column("name"), sa.column("description"), sa.column("category"), sa.column("price"), sa.column("status"), sa.column("asset_url"), sa.column("preview"), sa.column("created_at"), sa.column("updated_at"))
    op.bulk_insert(items, [
        {"id": 1, "slug": "lumi-mint", "name": "薄荷探险装", "description": "清爽的薄荷绿 Lumi 装扮", "category": "skin", "price": 30, "status": "active", "asset_url": None, "preview": "mint", "created_at": now, "updated_at": now},
        {"id": 2, "slug": "lumi-sunset", "name": "晚霞旅行装", "description": "温暖的珊瑚橙 Lumi 装扮", "category": "skin", "price": 45, "status": "active", "asset_url": None, "preview": "berry", "created_at": now, "updated_at": now},
        {"id": 3, "slug": "wonder-sky", "name": "奇境天空背景", "description": "为学习空间换上星空背景", "category": "background", "price": 60, "status": "active", "asset_url": None, "preview": "sky", "created_at": now, "updated_at": now},
    ])
    badges = sa.table("badge_definitions", sa.column("code"), sa.column("name"), sa.column("description"), sa.column("icon"), sa.column("criteria_type"), sa.column("threshold"), sa.column("status"))
    op.bulk_insert(badges, [
        {"code": "first-step", "name": "迈出第一步", "description": "完成第一个学习活动", "icon": "🌱", "criteria_type": "learning_events", "threshold": 1, "status": "active"},
        {"code": "lesson-explorer", "name": "课程探险家", "description": "完成 3 节课程", "icon": "🧭", "criteria_type": "completed_lessons", "threshold": 3, "status": "active"},
        {"code": "mistake-master", "name": "错题终结者", "description": "稳定掌握 3 个错题", "icon": "💡", "criteria_type": "mastered_items", "threshold": 3, "status": "active"},
    ])


def downgrade() -> None:
    for table in ["user_badges", "user_assets", "purchases", "points_transactions", "badge_definitions", "store_items", "reward_rules", "points_accounts"]:
        op.drop_table(table)
