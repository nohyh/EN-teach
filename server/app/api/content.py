"""教材资产、草稿、审核与发布管理 API。"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.core.config import get_settings
from app.db.database import get_db
from app.db.models import ContentAsset, Course, CourseDraft, CourseVersion, User
from app.repositories import content as content_repo
from app.services.content_service import parse_asset, publish_draft, validate_draft
from app.services.content_storage import get_content_storage
from app.services import operations


router = APIRouter(prefix="/api/v1/content", tags=["content-management"])

SOURCE_EXTENSIONS = {".json", ".md", ".markdown", ".txt", ".docx", ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg"}
ALLOWED_EXTENSIONS = {
    "source": SOURCE_EXTENSIONS,
    "cover": IMAGE_EXTENSIONS,
    "illustration": IMAGE_EXTENSIONS,
    "audio": AUDIO_EXTENSIONS,
}


def _valid_file_signature(suffix: str, payload: bytes) -> bool:
    """Reject obvious extension spoofing before the asset reaches parsers/storage."""
    if suffix == ".pdf":
        return payload.startswith(b"%PDF-")
    if suffix == ".docx":
        return payload.startswith(b"PK\x03\x04")
    if suffix == ".png":
        return payload.startswith(b"\x89PNG\r\n\x1a\n")
    if suffix in {".jpg", ".jpeg"}:
        return payload.startswith(b"\xff\xd8\xff")
    if suffix == ".webp":
        return len(payload) >= 12 and payload[:4] == b"RIFF" and payload[8:12] == b"WEBP"
    if suffix in {".tif", ".tiff"}:
        return payload.startswith((b"II*\x00", b"MM\x00*"))
    if suffix == ".wav":
        return len(payload) >= 12 and payload[:4] == b"RIFF" and payload[8:12] == b"WAVE"
    if suffix == ".ogg":
        return payload.startswith(b"OggS")
    if suffix == ".m4a":
        return len(payload) >= 12 and payload[4:8] == b"ftyp"
    if suffix == ".mp3":
        return payload.startswith(b"ID3") or payload[:2] in {b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"}
    if suffix in {".json", ".md", ".markdown", ".txt"}:
        return b"\x00" not in payload[:4096]
    return True


class DraftUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    grade: str | None = Field(default=None, max_length=32)
    theme: str | None = Field(default=None, max_length=64)
    difficulty: str | None = Field(default=None, max_length=32)
    content: dict[str, Any]


class ReviewRequest(BaseModel):
    note: str = Field(default="", max_length=2000)


def _can_manage(user: User, owner_id: int) -> bool:
    return user.role == "admin" or user.id == owner_id


def _asset_payload(asset: ContentAsset) -> dict[str, Any]:
    return {
        "id": asset.id,
        "owner_id": asset.owner_id,
        "asset_kind": asset.asset_kind,
        "original_filename": asset.original_filename,
        "mime_type": asset.mime_type,
        "size_bytes": asset.size_bytes,
        "sha256": asset.sha256,
        "status": asset.status,
        "grade": asset.grade,
        "theme": asset.theme,
        "difficulty": asset.difficulty,
        "language": asset.language,
        "copyright_source": asset.copyright_source,
        "usage_scope": asset.usage_scope,
        "copyright_confirmed": asset.copyright_confirmed,
        "parse_error": json.loads(asset.parse_error_json) if asset.parse_error_json else None,
        "created_at": asset.created_at,
        "updated_at": asset.updated_at,
    }


def _draft_payload(draft: CourseDraft, *, include_content: bool = True) -> dict[str, Any]:
    payload = {
        "id": draft.id,
        "asset_id": draft.asset_id,
        "course_id": draft.course_id,
        "base_version_id": draft.base_version_id,
        "owner_id": draft.owner_id,
        "title": draft.title,
        "description": draft.description or "",
        "grade": draft.grade,
        "theme": draft.theme,
        "difficulty": draft.difficulty,
        "language": draft.language,
        "status": draft.status,
        "validation_errors": json.loads(draft.validation_errors_json) if draft.validation_errors_json else [],
        "reviewed_by": draft.reviewed_by,
        "review_note": draft.review_note,
        "created_at": draft.created_at,
        "updated_at": draft.updated_at,
    }
    if include_content:
        payload["content"] = json.loads(draft.content_json)
    return payload


@router.post("/assets", status_code=202)
async def upload_asset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    asset_kind: Literal["source", "cover", "illustration", "audio"] = Form("source"),
    grade: str | None = Form(None),
    theme: str | None = Form(None),
    difficulty: str | None = Form(None),
    language: str = Form("en-zh"),
    copyright_source: str = Form(..., min_length=1, max_length=255),
    usage_scope: str = Form(..., min_length=1, max_length=64),
    copyright_confirmed: bool = Form(...),
    user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    if not copyright_confirmed:
        raise HTTPException(status_code=422, detail="必须确认拥有教材数字化和使用权限")
    filename = Path(file.filename or "").name
    suffix = Path(filename).suffix.lower()
    if not filename or suffix not in ALLOWED_EXTENSIONS[asset_kind]:
        raise HTTPException(
            status_code=415,
            detail=f"{asset_kind} 不支持该文件类型，允许：{sorted(ALLOWED_EXTENSIONS[asset_kind])}",
        )
    max_bytes = get_settings().content_max_upload_mb * 1024 * 1024
    payload = await file.read(max_bytes + 1)
    if not payload:
        raise HTTPException(status_code=400, detail="上传文件为空")
    if len(payload) > max_bytes:
        raise HTTPException(status_code=413, detail=f"文件不能超过 {get_settings().content_max_upload_mb} MiB")
    if b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE" in payload:
        raise HTTPException(status_code=422, detail="安全扫描未通过")
    if not _valid_file_signature(suffix, payload):
        raise HTTPException(status_code=415, detail="文件内容与扩展名不匹配或文件已损坏")

    asset_id = str(uuid4())
    storage_key = get_content_storage().save(payload, suffix)
    asset = ContentAsset(
        id=asset_id,
        owner_id=user.id,
        asset_kind=asset_kind,
        original_filename=filename,
        storage_key=storage_key,
        mime_type=(file.content_type or "application/octet-stream")[:128],
        size_bytes=len(payload),
        sha256=hashlib.sha256(payload).hexdigest(),
        status="uploaded",
        grade=grade,
        theme=theme,
        difficulty=difficulty,
        language=language,
        copyright_source=copyright_source,
        usage_scope=usage_scope,
        copyright_confirmed=True,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    if asset_kind == "source":
        background_tasks.add_task(parse_asset, asset.id)
    return _asset_payload(asset)


@router.get("/assets")
def list_assets(
    user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    owner_id = None if user.role == "admin" else user.id
    return [_asset_payload(asset) for asset in content_repo.list_assets(db, owner_id=owner_id)]


@router.get("/assets/{asset_id}")
def get_asset(
    asset_id: str,
    user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    asset = content_repo.get_asset(db, asset_id)
    if not asset or not _can_manage(user, asset.owner_id):
        raise HTTPException(status_code=404, detail="内容资产不存在")
    return _asset_payload(asset)


@router.post("/assets/{asset_id}/parse", status_code=202)
def retry_parse(
    asset_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    asset = content_repo.get_asset(db, asset_id)
    if not asset or not _can_manage(user, asset.owner_id):
        raise HTTPException(status_code=404, detail="内容资产不存在")
    if asset.asset_kind != "source":
        raise HTTPException(status_code=409, detail="只有教材源文件可以解析")
    asset.status = "uploaded"
    asset.parse_error_json = None
    db.commit()
    background_tasks.add_task(parse_asset, asset.id)
    return _asset_payload(asset)


@router.get("/drafts")
def list_drafts(
    user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    owner_id = None if user.role == "admin" else user.id
    return [_draft_payload(draft, include_content=False) for draft in content_repo.list_drafts(db, owner_id=owner_id)]


@router.get("/drafts/{draft_id}")
def get_draft(
    draft_id: int,
    user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    draft = content_repo.get_draft(db, draft_id)
    if not draft or not _can_manage(user, draft.owner_id):
        raise HTTPException(status_code=404, detail="课程草稿不存在")
    return _draft_payload(draft)


@router.put("/drafts/{draft_id}")
def update_draft(
    draft_id: int,
    request: DraftUpdateRequest,
    user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    draft = content_repo.get_draft(db, draft_id)
    if not draft or not _can_manage(user, draft.owner_id):
        raise HTTPException(status_code=404, detail="课程草稿不存在")
    if draft.status == "published":
        raise HTTPException(status_code=409, detail="已发布草稿不可修改，请从课程版本创建新草稿")
    draft.title = request.title
    draft.description = request.description
    draft.grade = request.grade
    draft.theme = request.theme
    draft.difficulty = request.difficulty
    draft.content_json = json.dumps(request.content, ensure_ascii=False)
    draft.status = "draft"
    draft.validation_errors_json = None
    draft.reviewed_by = None
    draft.review_note = None
    db.commit()
    db.refresh(draft)
    return _draft_payload(draft)


@router.post("/drafts/{draft_id}/validate")
def validate_draft_endpoint(
    draft_id: int,
    user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    draft = content_repo.get_draft(db, draft_id)
    if not draft or not _can_manage(user, draft.owner_id):
        raise HTTPException(status_code=404, detail="课程草稿不存在")
    if draft.status == "published":
        raise HTTPException(status_code=409, detail="已发布草稿不可重新校验")
    errors = validate_draft(db, draft)
    db.refresh(draft)
    return {"valid": not errors, "errors": errors, "draft": _draft_payload(draft)}


@router.post("/drafts/{draft_id}/approve")
def approve_draft(
    draft_id: int,
    request: ReviewRequest,
    user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    draft = content_repo.get_draft(db, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="课程草稿不存在")
    if draft.status != "ready_for_review":
        raise HTTPException(status_code=409, detail="草稿必须先通过校验")
    draft.status = "approved"
    draft.reviewed_by = user.id
    draft.review_note = request.note
    operations.audit(db, user.id, "course_draft.approve", "course_draft", draft.id, reason=request.note)
    db.commit()
    db.refresh(draft)
    return _draft_payload(draft)


@router.post("/drafts/{draft_id}/reject")
def reject_draft(
    draft_id: int,
    request: ReviewRequest,
    user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    draft = content_repo.get_draft(db, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="课程草稿不存在")
    if not request.note.strip():
        raise HTTPException(status_code=422, detail="驳回时必须填写原因")
    draft.status = "rejected"
    draft.reviewed_by = user.id
    draft.review_note = request.note
    operations.audit(db, user.id, "course_draft.reject", "course_draft", draft.id, reason=request.note)
    db.commit()
    db.refresh(draft)
    return _draft_payload(draft)


@router.post("/drafts/{draft_id}/publish", status_code=201)
def publish_draft_endpoint(
    draft_id: int,
    user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    draft = content_repo.get_draft(db, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="课程草稿不存在")
    if draft.status != "approved":
        raise HTTPException(status_code=409, detail="只有已审核通过的草稿可以发布")
    course, version = publish_draft(db, draft, actor_id=user.id)
    operations.audit(db, user.id, "course.publish", "course", course.id, detail={"version": version.version_number, "draft_id": draft.id})
    db.commit()
    return {"course": _course_payload(course), "version": _version_payload(version)}


def _course_payload(course: Course) -> dict[str, Any]:
    return {
        "id": course.id,
        "slug": course.slug,
        "title": course.title,
        "status": course.status,
        "current_version_id": course.current_version_id,
        "created_at": course.created_at,
        "updated_at": course.updated_at,
    }


def _version_payload(version: CourseVersion, *, include_content: bool = False) -> dict[str, Any]:
    payload = {
        "id": version.id,
        "course_id": version.course_id,
        "source_draft_id": version.source_draft_id,
        "version_number": version.version_number,
        "title": version.title,
        "manifest": json.loads(version.manifest_json),
        "created_by": version.created_by,
        "created_at": version.created_at,
    }
    if include_content:
        payload["content"] = json.loads(version.content_json)
    return payload


@router.get("/courses")
def list_managed_courses(
    _user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    return [_course_payload(course) for course in db.query(Course).order_by(Course.updated_at.desc()).all()]


@router.get("/courses/{course_id}/versions")
def list_course_versions(
    course_id: int,
    _user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    if not content_repo.get_course(db, course_id):
        raise HTTPException(status_code=404, detail="课程不存在")
    return [_version_payload(version) for version in content_repo.list_versions(db, course_id)]


@router.post("/courses/{course_id}/versions/{version_number}/rollback")
def rollback_course(
    course_id: int,
    version_number: int,
    user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    course = content_repo.get_course(db, course_id)
    version = content_repo.get_version(db, course_id, version_number)
    if not course or not version:
        raise HTTPException(status_code=404, detail="课程或版本不存在")
    course.current_version_id = version.id
    course.title = version.title
    course.status = "published"
    operations.audit(db, user.id, "course.rollback", "course", course.id, detail={"version": version.version_number})
    db.commit()
    db.refresh(course)
    return {"course": _course_payload(course), "version": _version_payload(version)}


@router.post("/courses/{course_id}/unpublish")
def unpublish_course(
    course_id: int,
    user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    course = content_repo.get_course(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    course.status = "unpublished"
    operations.audit(db, user.id, "course.unpublish", "course", course.id)
    db.commit()
    db.refresh(course)
    return _course_payload(course)


@router.post("/courses/{course_id}/drafts", status_code=201)
def create_draft_from_version(
    course_id: int,
    version_number: int | None = None,
    user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    course = content_repo.get_course(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    if version_number is None:
        version = db.get(CourseVersion, course.current_version_id) if course.current_version_id else None
    else:
        version = content_repo.get_version(db, course_id, version_number)
    if not version:
        raise HTTPException(status_code=404, detail="课程版本不存在")
    content = json.loads(version.content_json)
    draft = CourseDraft(
        course_id=course.id,
        base_version_id=version.id,
        owner_id=user.id,
        title=version.title,
        description=str(content.get("intro") or ""),
        status="draft",
        content_json=version.content_json,
        language="en-zh",
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return _draft_payload(draft)
