"""Stage 3 points, store, inventory and growth APIs."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_roles
from app.db.database import get_db
from app.db.models import PointsAccount, PointsTransaction, RewardRule, StoreItem, User
from app.services import economy, operations


router = APIRouter(prefix="/api/v1", tags=["economy"])


class PurchaseRequest(BaseModel):
    item_id: int
    idempotency_key: str = Field(min_length=12, max_length=160, pattern=r"^[A-Za-z0-9_.:-]+$")


class StoreItemRequest(BaseModel):
    slug: str = Field(min_length=2, max_length=96, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=2000)
    category: Literal["skin", "outfit", "background", "badge", "theme"]
    price: int = Field(ge=0, le=1_000_000)
    status: Literal["active", "inactive"] = "active"
    asset_url: str | None = Field(default=None, max_length=512)
    preview: str | None = Field(default=None, max_length=32)


class StoreItemPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=2000)
    price: int | None = Field(default=None, ge=0, le=1_000_000)
    status: Literal["active", "inactive"] | None = None
    asset_url: str | None = Field(default=None, max_length=512)
    preview: str | None = Field(default=None, max_length=32)


class RewardRulePatch(BaseModel):
    points: int | None = Field(default=None, ge=0, le=100_000)
    daily_limit: int | None = Field(default=None, ge=0, le=1_000_000)
    status: Literal["active", "inactive"] | None = None
    description: str | None = Field(default=None, max_length=255)


@router.get("/me/points")
def points(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = economy.account_for_update(db, user.id); db.commit(); db.refresh(account)
    return economy.account_payload(account)


@router.get("/me/points/transactions")
def transactions(limit: int = Query(50, ge=1, le=200), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(PointsTransaction).filter_by(user_id=user.id).order_by(PointsTransaction.id.desc()).limit(limit).all()
    return [economy.transaction_payload(row) for row in rows]


@router.get("/store/items")
def store_items(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned = {item["id"]: item for item in economy.list_assets(db, user.id)}
    rows = db.query(StoreItem).filter_by(status="active").order_by(StoreItem.category, StoreItem.price).all()
    return [economy.item_payload(row, row.id in owned, owned.get(row.id, {}).get("equipped", False)) for row in rows]


@router.post("/store/items", status_code=201)
def create_item(request: StoreItemRequest, admin: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    if db.query(StoreItem).filter_by(slug=request.slug).first():
        raise HTTPException(status_code=409, detail="商品标识已存在")
    item = StoreItem(**request.model_dump()); db.add(item); db.flush()
    operations.audit(db, admin.id, "store_item.create", "store_item", item.id, detail={"slug": item.slug, "price": item.price})
    db.commit(); db.refresh(item)
    return economy.item_payload(item)


@router.patch("/store/items/{item_id}")
def update_item(item_id: int, request: StoreItemPatch, admin: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    item = db.get(StoreItem, item_id)
    if not item: raise HTTPException(status_code=404, detail="商品不存在")
    changes = request.model_dump(exclude_unset=True)
    for key, value in changes.items(): setattr(item, key, value)
    operations.audit(db, admin.id, "store_item.update", "store_item", item.id, detail={"fields": sorted(changes)})
    db.commit(); db.refresh(item)
    return economy.item_payload(item)


@router.get("/admin/reward-rules")
def reward_rules(_: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    rows = db.query(RewardRule).order_by(RewardRule.code).all()
    return [{"code": row.code, "event_type": row.event_type, "points": row.points, "daily_limit": row.daily_limit, "status": row.status, "description": row.description, "updated_at": row.updated_at} for row in rows]


@router.patch("/admin/reward-rules/{code}")
def update_reward_rule(code: str, request: RewardRulePatch, admin: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    row = db.get(RewardRule, code)
    if not row:
        raise HTTPException(status_code=404, detail="奖励规则不存在")
    changes = request.model_dump(exclude_unset=True)
    for key, value in changes.items(): setattr(row, key, value)
    operations.audit(db, admin.id, "reward_rule.update", "reward_rule", row.code, detail={"fields": sorted(changes)})
    db.commit(); db.refresh(row)
    return {"code": row.code, "event_type": row.event_type, "points": row.points, "daily_limit": row.daily_limit, "status": row.status, "description": row.description, "updated_at": row.updated_at}


@router.post("/store/purchases", status_code=201)
def buy(request: PurchaseRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        purchase, duplicate = economy.purchase(db, user.id, request.item_id, request.idempotency_key)
        db.commit(); db.refresh(purchase)
    except ValueError as error:
        db.rollback(); raise HTTPException(status_code=409, detail=str(error)) from error
    account = db.get(PointsAccount, user.id)
    return {"id": purchase.id, "item_id": purchase.item_id, "price_paid": purchase.price_paid, "duplicate": duplicate, "balance": account.balance}


@router.get("/me/assets")
def assets(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return economy.list_assets(db, user.id)


@router.put("/me/assets/{item_id}/equip")
def equip(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        economy.equip(db, user.id, item_id); db.commit()
    except ValueError as error:
        db.rollback(); raise HTTPException(status_code=409, detail=str(error)) from error
    return {"item_id": item_id, "equipped": True, "assets": economy.list_assets(db, user.id)}


@router.get("/me/growth")
def growth(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payload = economy.growth_payload(db, user.id); db.commit()
    return payload
