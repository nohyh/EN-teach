"""数据库表结构"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.database import Base


def utcnow() -> datetime:
    """数据库统一存储无时区 UTC，避免依赖已弃用的 datetime.utcnow。"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(16), nullable=False)  # student | parent | teacher | admin
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class Classroom(Base):
    __tablename__ = "classrooms"
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    invite_code = Column(String(16), unique=True, nullable=False, index=True)
    status = Column(String(16), nullable=False, default="active", index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class ClassMembership(Base):
    __tablename__ = "class_memberships"
    __table_args__ = (UniqueConstraint("classroom_id", "student_id", name="uq_class_membership_student"),)
    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(16), nullable=False, default="active", index=True)
    joined_at = Column(DateTime, default=utcnow, nullable=False)


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    weekly_report = Column(Boolean, nullable=False, default=True)
    assignment_due = Column(Boolean, nullable=False, default=True)
    review_due = Column(Boolean, nullable=False, default=True)
    streak_reminder = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class StudentLearningPolicy(Base):
    __tablename__ = "student_learning_policies"
    __table_args__ = (
        CheckConstraint("daily_limit_minutes BETWEEN 5 AND 240", name="ck_learning_policy_daily_limit"),
    )
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    parent_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    is_configured = Column(Boolean, nullable=False, default=False)
    learning_enabled = Column(Boolean, nullable=False, default=True)
    daily_limit_minutes = Column(Integer, nullable=False, default=30)
    allowed_start = Column(String(5), nullable=False, default="06:00")
    allowed_end = Column(String(5), nullable=False, default="22:00")
    timezone = Column(String(64), nullable=False, default="Asia/Shanghai")
    voice_enabled = Column(Boolean, nullable=False, default=True)
    ai_enabled = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class DailyLearningUsage(Base):
    __tablename__ = "daily_learning_usage"
    __table_args__ = (
        UniqueConstraint("student_id", "usage_date", name="uq_daily_learning_usage_student_date"),
        CheckConstraint("active_seconds >= 0", name="ck_daily_learning_usage_nonnegative"),
    )
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    usage_date = Column(Date, nullable=False, index=True)
    active_seconds = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class LearningUsageEvent(Base):
    __tablename__ = "learning_usage_events"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    idempotency_key = Column(String(96), unique=True, nullable=False, index=True)
    active_seconds = Column(Integer, nullable=False)
    usage_date = Column(Date, nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String(64), nullable=False, index=True)
    target_type = Column(String(32), nullable=False, index=True)
    target_id = Column(String(128), nullable=False)
    reason = Column(String(500), nullable=True)
    detail_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    jti = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class Unit(Base):
    __tablename__ = "units"
    id = Column(String, primary_key=True)  # slug, e.g. "unit-1-hello"
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    order = Column(Integer, nullable=False)
    sentences = relationship("Sentence", back_populates="unit", order_by="Sentence.order")


class Sentence(Base):
    __tablename__ = "sentences"
    id = Column(String, primary_key=True)  # "unit-1-hello-sent-1"
    unit_id = Column(String, ForeignKey("units.id"), nullable=False)
    text = Column(Text, nullable=False)
    translation = Column(Text, nullable=True)
    audio_url = Column(String, nullable=True)
    order = Column(Integer, nullable=False)
    source = Column(String, default="sentences")
    unit = relationship("Unit", back_populates="sentences")


class UnitProgress(Base):
    __tablename__ = "unit_progress"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    unit_id = Column(String, ForeignKey("units.id"), nullable=False)
    status = Column(String, default="not_started")  # not_started / in_progress / completed
    completed_at = Column(DateTime, nullable=True)


class SentenceAttempt(Base):
    __tablename__ = "sentence_attempts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sentence_id = Column(String, ForeignKey("sentences.id"), nullable=False)
    audio_path = Column(String, nullable=False)
    overall = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=False)
    fluency = Column(Float, nullable=False)
    integrity = Column(Float, nullable=False)
    passed = Column(Boolean, nullable=False)
    word_scores_json = Column(Text, nullable=True)
    raw_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)


class ContentAsset(Base):
    __tablename__ = "content_assets"
    id = Column(String(36), primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    asset_kind = Column(String(24), nullable=False)  # source | cover | illustration | audio
    original_filename = Column(String(255), nullable=False)
    storage_key = Column(String(255), unique=True, nullable=False)
    mime_type = Column(String(128), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    sha256 = Column(String(64), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="uploaded", index=True)
    grade = Column(String(32), nullable=True)
    theme = Column(String(64), nullable=True)
    difficulty = Column(String(32), nullable=True)
    language = Column(String(16), nullable=False, default="en-zh")
    copyright_source = Column(String(255), nullable=False)
    usage_scope = Column(String(64), nullable=False)
    copyright_confirmed = Column(Boolean, nullable=False, default=False)
    extracted_text = Column(Text, nullable=True)
    parse_error_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(96), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    status = Column(String(24), nullable=False, default="unpublished", index=True)
    current_version_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class CourseDraft(Base):
    __tablename__ = "course_drafts"
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(String(36), ForeignKey("content_assets.id"), nullable=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True, index=True)
    base_version_id = Column(Integer, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    grade = Column(String(32), nullable=True)
    theme = Column(String(64), nullable=True)
    difficulty = Column(String(32), nullable=True)
    language = Column(String(16), nullable=False, default="en-zh")
    status = Column(String(32), nullable=False, default="draft", index=True)
    content_json = Column(Text, nullable=False)
    validation_errors_json = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class CourseVersion(Base):
    __tablename__ = "course_versions"
    __table_args__ = (UniqueConstraint("course_id", "version_number", name="uq_course_version_number"),)
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    source_draft_id = Column(Integer, ForeignKey("course_drafts.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    content_json = Column(Text, nullable=False)
    manifest_json = Column(Text, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class LearningEvent(Base):
    __tablename__ = "learning_events"
    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_ref = Column(String(128), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    course_version_id = Column(Integer, ForeignKey("course_versions.id"), nullable=True)
    client_progress_key = Column(String(128), nullable=False)
    section_id = Column(String(96), nullable=False)
    activity_index = Column(Integer, nullable=False)
    activity_type = Column(String(32), nullable=False)
    knowledge_key = Column(String(160), nullable=True)
    prompt = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=True)
    user_answer = Column(Text, nullable=True)
    correct = Column(Boolean, nullable=False)
    score_json = Column(Text, nullable=True)
    occurred_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class LearningProgress(Base):
    __tablename__ = "learning_progress"
    __table_args__ = (UniqueConstraint("user_id", "client_progress_key", name="uq_learning_progress_user_key"),)
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_ref = Column(String(128), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    course_version_id = Column(Integer, ForeignKey("course_versions.id"), nullable=True)
    client_progress_key = Column(String(128), nullable=False)
    section_id = Column(String(96), nullable=False)
    completed_activities = Column(Integer, nullable=False, default=0)
    total_activities = Column(Integer, nullable=False)
    status = Column(String(24), nullable=False, default="in_progress", index=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class KnowledgePoint(Base):
    __tablename__ = "knowledge_points"
    id = Column(Integer, primary_key=True, index=True)
    canonical_key = Column(String(64), unique=True, nullable=False, index=True)
    kind = Column(String(32), nullable=False, index=True)
    standard_content = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=True)
    course_ref = Column(String(128), nullable=False)
    section_id = Column(String(96), nullable=False)
    tags_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class WrongItem(Base):
    __tablename__ = "wrong_items"
    __table_args__ = (UniqueConstraint("user_id", "knowledge_point_id", name="uq_wrong_item_user_knowledge"),)
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    knowledge_point_id = Column(Integer, ForeignKey("knowledge_points.id", ondelete="CASCADE"), nullable=False, index=True)
    source_event_id = Column(Integer, ForeignKey("learning_events.id"), nullable=False)
    error_count = Column(Integer, nullable=False, default=1)
    review_count = Column(Integer, nullable=False, default=0)
    mastery_level = Column(Integer, nullable=False, default=0)
    correct_streak = Column(Integer, nullable=False, default=0)
    status = Column(String(24), nullable=False, default="active", index=True)
    next_review_at = Column(DateTime, nullable=False, index=True)
    last_wrong_at = Column(DateTime, nullable=False)
    last_review_at = Column(DateTime, nullable=True)
    mastered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class ReviewSession(Base):
    __tablename__ = "review_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(24), nullable=False, default="active", index=True)
    item_ids_json = Column(Text, nullable=False)
    item_count = Column(Integer, nullable=False)
    answered_count = Column(Integer, nullable=False, default=0)
    correct_count = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime, default=utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)


class WrongAttempt(Base):
    __tablename__ = "wrong_attempts"
    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String(64), unique=True, nullable=False, index=True)
    wrong_item_id = Column(Integer, ForeignKey("wrong_items.id", ondelete="CASCADE"), nullable=False, index=True)
    review_session_id = Column(Integer, ForeignKey("review_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_answer = Column(Text, nullable=True)
    correct = Column(Boolean, nullable=False)
    score_json = Column(Text, nullable=True)
    interval_days = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class Assignment(Base):
    __tablename__ = "assignments"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("assignment_batches.id", ondelete="SET NULL"), nullable=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    course_ref = Column(String(128), nullable=False)
    section_id = Column(String(96), nullable=False)
    total_activities = Column(Integer, nullable=False)
    starts_at = Column(DateTime, nullable=True)
    due_at = Column(DateTime, nullable=True, index=True)
    status = Column(String(24), nullable=False, default="assigned", index=True)
    instructions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class AssignmentBatch(Base):
    __tablename__ = "assignment_batches"
    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    course_ref = Column(String(128), nullable=False)
    section_id = Column(String(96), nullable=False)
    total_activities = Column(Integer, nullable=False)
    starts_at = Column(DateTime, nullable=True)
    due_at = Column(DateTime, nullable=True, index=True)
    allow_late = Column(Boolean, nullable=False, default=True)
    instructions = Column(Text, nullable=True)
    status = Column(String(24), nullable=False, default="active", index=True)
    revision = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class AssignmentProgress(Base):
    __tablename__ = "assignment_progress"
    __table_args__ = (UniqueConstraint("assignment_id", "student_id", name="uq_assignment_progress_student"),)
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    completed_activities = Column(Integer, nullable=False, default=0)
    status = Column(String(24), nullable=False, default="not_started", index=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class AssignmentFeedback(Base):
    __tablename__ = "assignment_feedback"
    __table_args__ = (UniqueConstraint("assignment_id", name="uq_assignment_feedback_assignment"),)
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    comment = Column(Text, nullable=False)
    encouragement_tag = Column(String(32), nullable=True)
    revision = Column(Integer, nullable=False, default=1)
    student_response = Column(String(500), nullable=True)
    responded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class PointsAccount(Base):
    __tablename__ = "points_accounts"
    __table_args__ = (CheckConstraint("balance >= 0", name="ck_points_account_nonnegative"),)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    balance = Column(Integer, nullable=False, default=0)
    version = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class PointsTransaction(Base):
    __tablename__ = "points_transactions"
    __table_args__ = (CheckConstraint("balance_after >= 0", name="ck_points_transaction_balance"),)
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    type = Column(String(32), nullable=False, index=True)  # reward | purchase | adjustment
    reason = Column(String(64), nullable=False, index=True)
    source_id = Column(String(128), nullable=False)
    idempotency_key = Column(String(160), unique=True, nullable=False, index=True)
    detail_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)


class RewardRule(Base):
    __tablename__ = "reward_rules"
    code = Column(String(64), primary_key=True)
    event_type = Column(String(32), nullable=False, index=True)
    points = Column(Integer, nullable=False)
    daily_limit = Column(Integer, nullable=False)
    status = Column(String(16), nullable=False, default="active", index=True)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class StoreItem(Base):
    __tablename__ = "store_items"
    __table_args__ = (CheckConstraint("price >= 0", name="ck_store_item_price"),)
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(96), unique=True, nullable=False, index=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(32), nullable=False, index=True)
    price = Column(Integer, nullable=False)
    status = Column(String(16), nullable=False, default="active", index=True)
    asset_url = Column(String(512), nullable=True)
    preview = Column(String(32), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class Purchase(Base):
    __tablename__ = "purchases"
    __table_args__ = (
        UniqueConstraint("user_id", "item_id", name="uq_purchase_user_item"),
    )
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("store_items.id"), nullable=False, index=True)
    price_paid = Column(Integer, nullable=False)
    idempotency_key = Column(String(160), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class UserAsset(Base):
    __tablename__ = "user_assets"
    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_user_asset_item"),)
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("store_items.id"), nullable=False, index=True)
    equipped = Column(Boolean, nullable=False, default=False, index=True)
    acquired_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class BadgeDefinition(Base):
    __tablename__ = "badge_definitions"
    code = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    description = Column(String(255), nullable=False)
    icon = Column(String(16), nullable=False)
    criteria_type = Column(String(32), nullable=False, index=True)
    threshold = Column(Integer, nullable=False)
    status = Column(String(16), nullable=False, default="active", index=True)


class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_code", name="uq_user_badge_code"),)
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_code = Column(String(64), ForeignKey("badge_definitions.code"), nullable=False, index=True)
    source_value = Column(Integer, nullable=False)
    awarded_at = Column(DateTime, default=utcnow, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(32), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    channel = Column(String(16), nullable=False, default="in_app")
    status = Column(String(16), nullable=False, default="delivered", index=True)
    dedupe_key = Column(String(180), unique=True, nullable=False, index=True)
    detail_json = Column(Text, nullable=True)
    delivered_at = Column(DateTime, default=utcnow, nullable=False)
    read_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
