"""ASTA API — FastAPI application entry point."""
from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.database.models import Base
from app.database.seed import seed
from app.database.session import SessionLocal, engine
from app.tools.art import media_path
import app.agents  # noqa: F401  (registers all specialists)

logging.basicConfig(
    level=logging.INFO,
    format='{"level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
)
logger = logging.getLogger("asta.api")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    (settings.upload_path)
    media_path()
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db)
    logger.info("ASTA API started environment=%s provider_mode=%s", settings.environment, settings.provider_mode)
    yield
    logger.info("ASTA API stopped")


app = FastAPI(
    title="ASTA API",
    description="Autonomous System for Task Automation — universal AI intelligence platform.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["X-Trace-Id"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    trace_id = request.headers.get("x-trace-id") or uuid.uuid4().hex
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("unhandled_error path=%s trace=%s", request.url.path, trace_id)
        return JSONResponse(
            status_code=500,
            content={"detail": "An unexpected error occurred.", "trace_id": trace_id},
        )
    duration = int((time.perf_counter() - started) * 1000)
    response.headers["X-Trace-Id"] = trace_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    if request.url.path.startswith("/api"):
        logger.info("request method=%s path=%s status=%s ms=%s", request.method, request.url.path, response.status_code, duration)
    return response


@app.get("/health", tags=["system"])
def health():
    try:
        with SessionLocal() as db:
            from sqlalchemy import text

            db.execute(text("SELECT 1"))
        database = "ok"
    except Exception as exc:  # noqa: BLE001
        database = f"error: {exc}"
    return {
        "status": "ok" if database == "ok" else "degraded",
        "service": "asta-api",
        "version": "0.1.0",
        "environment": settings.environment,
        "database": database,
    }


from app.api.v1.router import api_router  # noqa: E402  (after app creation to avoid cycles)

app.include_router(api_router, prefix=settings.api_prefix)
