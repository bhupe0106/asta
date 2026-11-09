"""Authenticated tool endpoints that are safe to expose to the workspace UI."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.config import settings
from app.database.models import FeatureFlag, User
from app.database.session import get_db
from app.tools.sandbox import ISOLATION, SandboxError, run_python

router = APIRouter(tags=["tools"])


class CodeRun(BaseModel):
    code: str = Field(min_length=1, max_length=20_000)
    timeout_seconds: float | None = Field(default=None, ge=1, le=20)


@router.get("/tools")
def list_tools(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    flags = {flag.key: flag.enabled for flag in db.scalars(select(FeatureFlag)).all()}
    return {
        "tools": [
            {
                "key": "code.sandbox",
                "available": flags.get("sandboxed_code", False) and settings.sandbox_enabled,
                "isolation": ISOLATION,
                "languages": ["python"],
                "timeout_default": settings.sandbox_timeout_seconds,
            },
            {
                "key": "media.procedural",
                "available": True,
                "modes": ["image", "video"],
                "model": "none (deterministic vector synthesis)",
            },
            {
                "key": "search.web",
                "available": settings.search_provider != "disabled",
                "provider": settings.search_provider,
            },
        ]
    }


@router.post("/tools/code/run")
async def run_code(
    payload: CodeRun,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    flag = db.get(FeatureFlag, "sandboxed_code")
    if not settings.sandbox_enabled or not flag or not flag.enabled:
        raise HTTPException(status_code=503, detail="Code execution is disabled on this deployment.")
    try:
        result = await run_python(payload.code, timeout=payload.timeout_seconds)
    except SandboxError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        **result,
        "language": "python",
        "note": (
            "Executed on the API host in a short-lived, isolated-mode Python process. "
            "This is best-effort isolation, not a hardened security sandbox."
        ),
    }
