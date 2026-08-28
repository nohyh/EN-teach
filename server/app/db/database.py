"""SQLAlchemy session / Base / 依赖注入"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


_settings = get_settings()
engine = create_engine(
    _settings.database_url,
    connect_args={"check_same_thread": False},  # SQLite 多线程
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    """FastAPI 依赖: 每个请求一个 session, 请求结束自动 close"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """建表 (首次启动时调用)"""
    # 导入 models 让 SQLAlchemy 知道表结构
    from app.db import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
