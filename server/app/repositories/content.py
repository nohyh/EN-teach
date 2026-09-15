"""教材内容平台数据访问。"""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import ContentAsset, Course, CourseDraft, CourseVersion


def get_asset(db: Session, asset_id: str) -> ContentAsset | None:
    return db.get(ContentAsset, asset_id)


def list_assets(db: Session, *, owner_id: int | None = None) -> list[ContentAsset]:
    query = db.query(ContentAsset)
    if owner_id is not None:
        query = query.filter(ContentAsset.owner_id == owner_id)
    return query.order_by(ContentAsset.created_at.desc()).all()


def get_draft(db: Session, draft_id: int) -> CourseDraft | None:
    return db.get(CourseDraft, draft_id)


def list_drafts(db: Session, *, owner_id: int | None = None) -> list[CourseDraft]:
    query = db.query(CourseDraft)
    if owner_id is not None:
        query = query.filter(CourseDraft.owner_id == owner_id)
    return query.order_by(CourseDraft.updated_at.desc()).all()


def get_course(db: Session, course_id: int) -> Course | None:
    return db.get(Course, course_id)


def get_published_by_slug(db: Session, slug: str) -> Course | None:
    return db.query(Course).filter(Course.slug == slug, Course.status == "published").first()


def list_published(db: Session) -> list[Course]:
    return db.query(Course).filter(Course.status == "published").order_by(Course.id).all()


def next_version_number(db: Session, course_id: int) -> int:
    current = db.query(func.max(CourseVersion.version_number)).filter(CourseVersion.course_id == course_id).scalar()
    return int(current or 0) + 1


def get_version(db: Session, course_id: int, version_number: int) -> CourseVersion | None:
    return db.query(CourseVersion).filter_by(course_id=course_id, version_number=version_number).first()


def list_versions(db: Session, course_id: int) -> list[CourseVersion]:
    return db.query(CourseVersion).filter_by(course_id=course_id).order_by(CourseVersion.version_number.desc()).all()
