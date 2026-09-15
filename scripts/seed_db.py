"""把 dd.md 通过内容适配器导入数据库, 同时灌入 fruit 单元 (prototype 用的 apple/banana/orange)

用法: python scripts/seed_db.py
"""
import sys
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVER = ROOT / "server"
sys.path.insert(0, str(ROOT))         # content.adapters
sys.path.insert(0, str(SERVER))       # app.xxx

from app.db.database import SessionLocal
from app.db import models
from app.core.security import hash_password
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

        # 3. 默认账号（仅用于本地演示，生产环境必须关闭灌库流程）
        parent = db.query(models.User).filter_by(id=1).first()
        if not parent:
            parent = models.User(
                id=1,
                username="lumi_parent",
                password_hash=hash_password("LumiDemo123!"),
                role="parent",
                name="测试家长",
            )
            db.add(parent)
        else:
            parent.username = "lumi_parent"
            parent.role = "parent"
            if not parent.password_hash or parent.password_hash.startswith("!"):
                parent.password_hash = hash_password("LumiDemo123!")

        student = db.query(models.User).filter_by(id=2).first()
        if not student:
            student = models.User(
                id=2,
                username="lumi_student",
                password_hash=hash_password("LumiDemo123!"),
                role="student",
                name="小明",
                parent_id=1,
            )
            db.add(student)
        else:
            student.username = "lumi_student"
            student.role = "student"
            student.parent_id = 1
            if not student.password_hash or student.password_hash.startswith("!"):
                student.password_hash = hash_password("LumiDemo123!")

        admin = db.query(models.User).filter_by(id=3).first()
        if not admin:
            admin = models.User(
                id=3,
                username="lumi_admin",
                password_hash=hash_password("LumiAdmin123!"),
                role="admin",
                name="Lumi 内容管理员",
            )
            db.add(admin)
        else:
            admin.username = "lumi_admin"
            admin.role = "admin"
            if not admin.password_hash or admin.password_hash.startswith("!"):
                admin.password_hash = hash_password("LumiAdmin123!")

        teacher = db.query(models.User).filter_by(username="lumi_teacher").first()
        if not teacher:
            teacher = models.User(
                username="lumi_teacher",
                password_hash=hash_password("LumiTeacher123!"),
                role="teacher",
                name="王老师",
            )
            db.add(teacher)
        else:
            teacher.role = "teacher"
            teacher.name = "王老师"
            if not teacher.password_hash or teacher.password_hash.startswith("!"):
                teacher.password_hash = hash_password("LumiTeacher123!")

        db.flush()
        classroom = db.query(models.Classroom).filter_by(invite_code="LUMI2026").first()
        if not classroom:
            classroom = models.Classroom(
                teacher_id=teacher.id, name="一年级星星班", invite_code="LUMI2026", status="active",
            )
            db.add(classroom)
            db.flush()
        membership = db.query(models.ClassMembership).filter_by(
            classroom_id=classroom.id, student_id=student.id,
        ).first()
        if not membership:
            db.add(models.ClassMembership(classroom_id=classroom.id, student_id=student.id, status="active"))
        else:
            membership.status = "active"

        # 4. 阶段 2 云端作业样本；进度只能由学习事件推进。
        db.flush()
        assignment = db.query(models.Assignment).filter_by(
            student_id=student.id,
            course_ref="mock:0",
            section_id="lesson_01_greetings",
            title="Hello! 第一次打招呼",
        ).first()
        if not assignment:
            assignment = models.Assignment(
                teacher_id=admin.id,
                student_id=student.id,
                title="Hello! 第一次打招呼",
                course_ref="mock:0",
                section_id="lesson_01_greetings",
                total_activities=16,
                due_at=models.utcnow() + timedelta(days=7),
                status="assigned",
                instructions="完成第一节全部活动，作业进度会自动同步。",
            )
            db.add(assignment)
            db.flush()
            db.add(models.AssignmentProgress(assignment_id=assignment.id, student_id=student.id))

        batch = db.query(models.AssignmentBatch).filter_by(
            classroom_id=classroom.id,
            title="Hello! 第一次打招呼",
        ).first()
        if not batch:
            batch = models.AssignmentBatch(
                classroom_id=classroom.id,
                teacher_id=teacher.id,
                title=assignment.title,
                course_ref=assignment.course_ref,
                section_id=assignment.section_id,
                total_activities=assignment.total_activities,
                starts_at=assignment.starts_at,
                due_at=assignment.due_at,
                allow_late=True,
                instructions=assignment.instructions,
                status="active",
                revision=1,
            )
            db.add(batch)
            db.flush()
        assignment.batch_id = batch.id
        assignment.teacher_id = teacher.id

        db.commit()

    with SessionLocal() as db:
        n_units = db.query(models.Unit).count()
        n_sentences = db.query(models.Sentence).count()
        n_users = db.query(models.User).count()
        print(f"DB: {n_units} units, {n_sentences} sentences, {n_users} users")


if __name__ == "__main__":
    main()
