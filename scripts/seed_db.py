"""把 dd.md 通过内容适配器导入数据库, 同时灌入 fruit 单元 (prototype 用的 apple/banana/orange)

用法: python scripts/seed_db.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVER = ROOT / "server"
sys.path.insert(0, str(ROOT))         # content.adapters
sys.path.insert(0, str(SERVER))       # app.xxx

from app.db.database import SessionLocal, init_db
from app.db import models
from content.source import ContentSource
from content.adapters.base import AdapterRegistry
import content.adapters  # 触发注册


# prototype 用的单词 / 句子 (demo8 seed_fruit.py 的内容)
FRUIT_UNIT_ID = "unit-fruit"
FRUIT_WORDS = [
    ("apple",  "苹果"),
    ("banana", "香蕉"),
    ("orange", "橙子"),
    ("I like apples.",  "我喜欢苹果。"),
    ("I like bananas.", "我喜欢香蕉。"),
    ("I like oranges.", "我喜欢橙子。"),
]


def main():
    init_db()
    src = ContentSource(path=ROOT / "dd.md")
    units = AdapterRegistry.parse(src)
    print(f"从 dd.md 解析出 {len(units)} 个 Unit")

    with SessionLocal() as db:
        # 1. dd.md 的 unit / sentence
        for u in units:
            existing = db.query(models.Unit).filter_by(id=u.id).first()
            if existing:
                # 先清掉旧句子再删 Unit, 否则 ORM 会把 unit_id 置空, 撞 NOT NULL 约束
                db.query(models.Sentence).filter_by(unit_id=u.id).delete(
                    synchronize_session=False
                )
                db.delete(existing)
                db.flush()
            db.add(models.Unit(
                id=u.id, name=u.name, description=u.description, order=u.order,
            ))
            for s in u.sentences:
                db.add(models.Sentence(
                    id=s.id, unit_id=s.unit_id, text=s.text,
                    translation=s.translation, audio_url=s.audio_url,
                    order=s.order, source=s.source,
                ))

        # 2. fruit 单元 (prototype 用)
        if not db.query(models.Unit).filter_by(id=FRUIT_UNIT_ID).first():
            db.add(models.Unit(
                id=FRUIT_UNIT_ID,
                name="Fruit Friends",
                description="水果朋友 (prototype 专用)",
                order=99,
            ))
            db.flush()
        for i, (text, translation) in enumerate(FRUIT_WORDS, start=1):
            sid = f"{FRUIT_UNIT_ID}-sent-{i}"
            if not db.query(models.Sentence).filter_by(id=sid).first():
                db.add(models.Sentence(
                    id=sid,
                    unit_id=FRUIT_UNIT_ID,
                    text=text,
                    translation=translation,
                    order=i,
                    source="fruit-seed",
                ))

        # 3. 默认账号 (开发用, 生产要走注册流程)
        if not db.query(models.User).filter_by(id=1).first():
            db.add(models.User(id=1, role="parent", name="测试家长"))
        if not db.query(models.User).filter_by(id=2).first():
            db.add(models.User(id=2, role="child", name="小明", parent_id=1))

        db.commit()

    with SessionLocal() as db:
        n_units = db.query(models.Unit).count()
        n_sentences = db.query(models.Sentence).count()
        n_users = db.query(models.User).count()
        print(f"DB: {n_units} units, {n_sentences} sentences, {n_users} users")


if __name__ == "__main__":
    main()
