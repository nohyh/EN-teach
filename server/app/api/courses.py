"""学生端只读已发布课程；草稿和未发布内容永不从这里暴露。"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import CourseVersion
from app.repositories import content as content_repo


router = APIRouter(prefix="/api/v1/courses", tags=["published-courses"])


def _published_payload(course, version: CourseVersion, *, include_content: bool) -> dict:
    payload = {
        "id": course.id,
        "slug": course.slug,
        "title": course.title,
        "version": version.version_number,
        "published_at": version.created_at,
        "manifest": json.loads(version.manifest_json),
    }
    if include_content:
        payload["content"] = json.loads(version.content_json)
    return payload


@router.get("")
def list_published_courses(db: Session = Depends(get_db)):
    result = []
    for course in content_repo.list_published(db):
        version = db.get(CourseVersion, course.current_version_id) if course.current_version_id else None
        if version and version.course_id == course.id:
            result.append(_published_payload(course, version, include_content=False))
    return result


@router.get("/{slug}")
def get_published_course(slug: str, db: Session = Depends(get_db)):
    course = content_repo.get_published_by_slug(db, slug)
    if not course or not course.current_version_id:
        raise HTTPException(status_code=404, detail="课程不存在或尚未发布")
    version = db.get(CourseVersion, course.current_version_id)
    if not version or version.course_id != course.id:
        raise HTTPException(status_code=503, detail="课程当前版本不可用")
    return _published_payload(course, version, include_content=True)


@router.get("/{slug}/versions/{version_number}")
def get_published_course_version(slug: str, version_number: int, db: Session = Depends(get_db)):
    course = content_repo.get_published_by_slug(db, slug)
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在或尚未发布")
    version = content_repo.get_version(db, course.id, version_number)
    if not version:
        raise HTTPException(status_code=404, detail="课程版本不存在")
    return _published_payload(course, version, include_content=True)
