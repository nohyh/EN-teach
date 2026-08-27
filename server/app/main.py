"""FastAPI 应用入口

uvicorn app.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import attempts, tts, units
from app.db.database import init_db


def create_app() -> FastAPI:
    init_db()
    app = FastAPI(title="EN-teach Backend", version="0.1.0")

    # CORS: 允许浏览器从 file:// 或其他端口调过来 (prototype 是 file:// 打开的)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # demo 阶段全开, 生产要锁白名单
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(units.router)
    app.include_router(attempts.router)
    app.include_router(tts.router)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
