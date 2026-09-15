"""Server-authoritative points, store, inventory, badges and growth summaries."""
from __future__ import annotations

import hashlib
import json
from datetime import timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import (
    AssignmentProgress, BadgeDefinition, LearningEvent, LearningProgress, PointsAccount,
    PointsTransaction, Purchase, RewardRule, StoreItem, UserAsset, UserBadge, WrongAttempt,
    WrongItem, utcnow,
)


def account_for_update(db: Session, user_id: int) -> PointsAccount:
    account = db.query(PointsAccount).filter_by(user_id=user_id).with_for_update().first()
    if account:
        return account
    account = PointsAccount(user_id=user_id, balance=0, version=0)
    db.add(account)
    db.flush()
    return account


def account_payload(account: PointsAccount) -> dict:
    return {"balance": account.balance, "version": account.version, "updated_at": account.updated_at}


def transaction_payload(row: PointsTransaction) -> dict:
    return {
        "id": row.id, "amount": row.amount, "balance_after": row.balance_after,
        "type": row.type, "reason": row.reason, "source_id": row.source_id,
        "detail": json.loads(row.detail_json) if row.detail_json else None,
        "created_at": row.created_at,
    }


def post_transaction(
    db: Session, user_id: int, *, amount: int, transaction_type: str, reason: str,
    source_id: str, idempotency_key: str, detail: dict | None = None,
) -> tuple[PointsTransaction, bool]:
    existing = db.query(PointsTransaction).filter_by(idempotency_key=idempotency_key).first()
    if existing:
        if existing.user_id != user_id:
            raise ValueError("幂等键已被其他用户使用")
        return existing, True
    account = account_for_update(db, user_id)
    next_balance = account.balance + amount
    if next_balance < 0:
        raise ValueError("积分余额不足")
    account.balance = next_balance
    account.version += 1
    row = PointsTransaction(
        user_id=user_id, amount=amount, balance_after=next_balance, type=transaction_type,
        reason=reason, source_id=source_id, idempotency_key=idempotency_key,
        detail_json=json.dumps(detail, ensure_ascii=False) if detail else None,
    )
    db.add(row)
    db.flush()
    return row, False


def award(db: Session, user_id: int, rule_code: str, source_id: str) -> PointsTransaction | None:
    key = f"reward:{user_id}:{rule_code}:{source_id}"
    existing = db.query(PointsTransaction).filter_by(idempotency_key=key).first()
    if existing:
        return existing
    rule = db.get(RewardRule, rule_code)
    if not rule or rule.status != "active" or rule.points <= 0:
        return None
    day_start = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    awarded_today = db.query(func.coalesce(func.sum(PointsTransaction.amount), 0)).filter(
        PointsTransaction.user_id == user_id, PointsTransaction.type == "reward",
        PointsTransaction.reason == rule.code, PointsTransaction.created_at >= day_start,
    ).scalar() or 0
    amount = min(rule.points, max(0, rule.daily_limit - awarded_today))
    if amount <= 0:
        return None
    row, _ = post_transaction(
        db, user_id, amount=amount, transaction_type="reward", reason=rule.code,
        source_id=source_id, idempotency_key=key,
        detail={"description": rule.description, "daily_limit": rule.daily_limit},
    )
    return row


def reward_learning_event(db: Session, event: LearningEvent, progress: LearningProgress, newly_completed: bool) -> None:
    if event.correct:
        award(db, event.user_id, "activity_correct", str(event.id))
    if newly_completed:
        award(db, event.user_id, "lesson_complete", progress.client_progress_key)
        wrong_count = db.query(LearningEvent).filter_by(
            user_id=event.user_id, client_progress_key=progress.client_progress_key, correct=False,
        ).count()
        if wrong_count == 0:
            award(db, event.user_id, "first_perfect", progress.client_progress_key)


def purchase(db: Session, user_id: int, item_id: int, idempotency_key: str) -> tuple[Purchase, bool]:
    # Serialize every purchase for this wallet before checking idempotency/ownership.
    # This prevents two concurrent requests from both observing a stale balance.
    account_for_update(db, user_id)
    persisted_key = f"purchase:{user_id}:{hashlib.sha256(idempotency_key.encode()).hexdigest()}"
    existing = db.query(Purchase).filter_by(idempotency_key=persisted_key).first()
    if existing:
        if existing.user_id != user_id or existing.item_id != item_id:
            raise ValueError("幂等键已用于其他购买")
        return existing, True
    owned = db.query(Purchase).filter_by(user_id=user_id, item_id=item_id).first()
    if owned:
        return owned, True
    item = db.get(StoreItem, item_id)
    if not item or item.status != "active":
        raise ValueError("商品不存在或已下架")
    post_transaction(
        db, user_id, amount=-item.price, transaction_type="purchase", reason="store_purchase",
        source_id=str(item.id), idempotency_key=f"purchase-points:{persisted_key}",
        detail={"item_id": item.id, "item_name": item.name, "price": item.price},
    )
    row = Purchase(user_id=user_id, item_id=item.id, price_paid=item.price, idempotency_key=persisted_key)
    db.add(row); db.flush()
    db.add(UserAsset(user_id=user_id, item_id=item.id, equipped=False))
    db.flush()
    return row, False


def item_payload(item: StoreItem, owned: bool = False, equipped: bool = False) -> dict:
    return {
        "id": item.id, "slug": item.slug, "name": item.name, "description": item.description,
        "category": item.category, "price": item.price, "status": item.status,
        "asset_url": item.asset_url, "preview": item.preview, "owned": owned, "equipped": equipped,
    }


def list_assets(db: Session, user_id: int) -> list[dict]:
    rows = db.query(UserAsset, StoreItem).join(StoreItem, StoreItem.id == UserAsset.item_id).filter(UserAsset.user_id == user_id).all()
    return [item_payload(item, owned=True, equipped=asset.equipped) for asset, item in rows]


def equip(db: Session, user_id: int, item_id: int) -> UserAsset:
    asset = db.query(UserAsset).filter_by(user_id=user_id, item_id=item_id).first()
    if not asset:
        raise ValueError("尚未拥有该商品")
    item = db.get(StoreItem, item_id)
    for other, other_item in db.query(UserAsset, StoreItem).join(StoreItem, StoreItem.id == UserAsset.item_id).filter(
        UserAsset.user_id == user_id, StoreItem.category == item.category,
    ).all():
        other.equipped = other.id == asset.id
    db.flush()
    return asset


def _growth_values(db: Session, user_id: int) -> dict[str, int]:
    since = utcnow() - timedelta(days=7)
    learning_events = db.query(LearningEvent).filter_by(user_id=user_id)
    review_attempts = db.query(WrongAttempt).join(WrongItem, WrongItem.id == WrongAttempt.wrong_item_id).filter(WrongItem.user_id == user_id)
    review_total = review_attempts.count()
    review_correct = review_attempts.filter(WrongAttempt.correct.is_(True)).count()
    return {
        "learning_events": learning_events.count(),
        "weekly_learning_events": learning_events.filter(LearningEvent.created_at >= since).count(),
        "completed_lessons": db.query(LearningProgress).filter_by(user_id=user_id, status="completed").count(),
        "completed_assignments": db.query(AssignmentProgress).filter_by(student_id=user_id, status="completed").count(),
        "mastered_items": db.query(WrongItem).filter_by(user_id=user_id, status="mastered").count(),
        "review_total": review_total,
        "review_correct": review_correct,
        "review_accuracy": round(review_correct * 100 / review_total) if review_total else 0,
    }


def sync_badges(db: Session, user_id: int) -> None:
    values = _growth_values(db, user_id)
    for badge in db.query(BadgeDefinition).filter_by(status="active").all():
        value = values.get(badge.criteria_type, 0)
        if value >= badge.threshold and not db.query(UserBadge).filter_by(user_id=user_id, badge_code=badge.code).first():
            db.add(UserBadge(user_id=user_id, badge_code=badge.code, source_value=value))
            award(db, user_id, "badge_unlock", badge.code)
    db.flush()


def growth_payload(db: Session, user_id: int) -> dict:
    sync_badges(db, user_id)
    values = _growth_values(db, user_id)
    badges = db.query(UserBadge, BadgeDefinition).join(BadgeDefinition, BadgeDefinition.code == UserBadge.badge_code).filter(UserBadge.user_id == user_id).order_by(UserBadge.awarded_at).all()
    account = account_for_update(db, user_id)
    return {
        **values, "points": account.balance,
        "badges": [{"code": badge.badge_code, "name": definition.name, "description": definition.description, "icon": definition.icon, "awarded_at": badge.awarded_at} for badge, definition in badges],
    }
