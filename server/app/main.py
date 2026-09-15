"""FastAPI 应用入口

uvicorn app.main:app --reload --port 8000
"""
import logging

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import ai, asr, assignments, attempts, auth, content, courses, economy, learning, operations, parent_controls, tts, units
from app.core.config import get_settings
from app.core.logging import RequestLogMiddleware, configure_logging
from app.db.database import engine


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.app_env,
            traces_sample_rate=settings.sentry_traces_sample_rate,
            send_default_pii=False,
        )
    app = FastAPI(title="EN-teach Backend", version="0.1.0")

    # 演示期允许 Expo Web / 本地开发端口访问；上线前改为部署域名白名单。
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestLogMiddleware)

    app.include_router(auth.router)
    app.include_router(content.router)
    app.include_router(courses.router)
    app.include_router(learning.router)
    app.include_router(economy.router)
    app.include_router(assignments.router)
    app.include_router(operations.router)
    app.include_router(parent_controls.router)
    app.include_router(units.router)
    app.include_router(attempts.router)
    app.include_router(tts.router)
    app.include_router(ai.router)
    app.include_router(asr.router)

    @app.get("/health")
    def health():
        return {"status": "ok", "environment": settings.app_env}

    @app.get("/ready")
    def ready():
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
                migration = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
            return {
                "status": "ready",
                "database": engine.dialect.name,
                "migration": migration,
            }
        except Exception:
            logging.getLogger("en_teach.readiness").exception("database_not_ready")
            return JSONResponse(status_code=503, content={"status": "not_ready"})

    @app.exception_handler(Exception)
    async def unhandled_error(request: Request, error: Exception):
        request_id = getattr(request.state, "request_id", "unknown")
        logging.getLogger("en_teach.error").exception(
            "unhandled_error",
            extra={"request_id": request_id, "path": request.url.path},
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "服务器内部错误", "request_id": request_id},
        )

    return app


app = create_app()
