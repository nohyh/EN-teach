"""数据库表结构"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    role = Column(String, nullable=False)  # "parent" | "child"
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


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
    created_at = Column(DateTime, default=datetime.utcnow)
