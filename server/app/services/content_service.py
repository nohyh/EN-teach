"""内容解析任务和课程发布工作流。"""
from __future__ import annotations

import json
import re

from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.db.models import ContentAsset, Course, CourseDraft, CourseVersion
from app.repositories import content as content_repo
from app.services.content_parser import ContentParseError, parse_source, validate_course_content
from app.services.content_storage import get_content_storage


def parse_asset(asset_id: str) -> None:
    with SessionLocal() as db:
        asset = content_repo.get_asset(db, asset_id)
        if not asset:
            return
        if asset.asset_kind != "source":
            asset.status = "uploaded"
            db.commit()
            return
        suffix = asset.original_filename.lower().rsplit(".", 1)[-1] if "." in asset.original_filename else ""
        if suffix in {"png", "jpg", "jpeg", "webp", "tif", "tiff"}:
            asset.status = "ocr_pending"
            db.commit()
            return
        asset.status = "parsing"
        asset.parse_error_json = None
        db.commit()
        try:
            payload = get_content_storage().read(asset.storage_key)
            raw_content, extracted_text = parse_source(asset.original_filename, payload)
            asset.status = "generating"
            db.commit()
            canonical, errors = validate_course_content(raw_content)
            draft = CourseDraft(
                asset_id=asset.id,
                owner_id=asset.owner_id,
                title=str(raw_content.get("title") or asset.original_filename),
                description=str(raw_content.get("intro") or ""),
                grade=asset.grade,
                theme=asset.theme,
                difficulty=asset.difficulty,
                language=asset.language,
                status="ready_for_review" if canonical else "validation_failed",
                content_json=json.dumps(canonical or raw_content, ensure_ascii=False),
                validation_errors_json=json.dumps(errors, ensure_ascii=False) if errors else None,
            )
            asset.extracted_text = extracted_text[:2_000_000]
            asset.status = "parsed"
            db.add(draft)
            db.commit()
        except ContentParseError as error:
            asset.status = "parse_failed"
            asset.parse_error_json = json.dumps(
                {"location": error.location, "message": str(error)}, ensure_ascii=False
            )
            db.commit()
        except Exception:
            asset.status = "parse_failed"
            asset.parse_error_json = json.dumps(
                {"location": "server", "message": "解析任务发生内部错误"}, ensure_ascii=False
            )
            db.commit()


def validate_draft(db: Session, draft: CourseDraft) -> list[dict[str, str]]:
    try:
        raw = json.loads(draft.content_json)
    except json.JSONDecodeError as error:
        errors = [{"location": f"json.line.{error.lineno}", "message": error.msg, "type": "json_invalid"}]
        draft.status = "validation_failed"
        draft.validation_errors_json = json.dumps(errors, ensure_ascii=False)
        db.commit()
        return errors
    canonical, errors = validate_course_content(raw)
    draft.status = "ready_for_review" if canonical else "validation_failed"
    draft.validation_errors_json = json.dumps(errors, ensure_ascii=False) if errors else None
    if canonical:
        draft.content_json = json.dumps(canonical, ensure_ascii=False)
        draft.title = canonical["title"]
        draft.description = canonical.get("intro", "")
    db.commit()
    return errors


def _course_slug(title: str, draft_id: int) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return (slug[:72] or "course") + f"-{draft_id}"


def publish_draft(db: Session, draft: CourseDraft, *, actor_id: int) -> tuple[Course, CourseVersion]:
    if draft.status != "approved":
        raise ValueError("只有已审核通过的草稿可以发布")
    course = content_repo.get_course(db, draft.course_id) if draft.course_id else None
    if not course:
        course = Course(slug=_course_slug(draft.title, draft.id), title=draft.title, status="unpublished")
        db.add(course)
        db.flush()
        draft.course_id = course.id
    version_number = content_repo.next_version_number(db, course.id)
    asset_ids = [draft.asset_id] if draft.asset_id else []
    version = CourseVersion(
        course_id=course.id,
        source_draft_id=draft.id,
        version_number=version_number,
        title=draft.title,
        content_json=draft.content_json,
        manifest_json=json.dumps({"asset_ids": asset_ids}, ensure_ascii=False),
        created_by=actor_id,
    )
    db.add(version)
    db.flush()
    course.current_version_id = version.id
    course.title = draft.title
    course.status = "published"
    draft.status = "published"
    db.commit()
    db.refresh(course)
    db.refresh(version)
    return course, version
