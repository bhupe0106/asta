"""Procedural media generation.

These endpoints create original SVG artwork on the local server. They are not a
diffusion model and do not claim to be; every response carries
``mode="procedural"`` so clients can label it honestly.
"""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.database.models import User
from app.tools.art import generate_artifact, media_path

router = APIRouter(tags=["media"])
SAFE_NAME = re.compile(r"^[a-f0-9]{32}\.svg$")


class GenerateArt(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)
    kind: str = Field(default="image", pattern="^(image|video)$")


@router.post("/media/generate", status_code=201)
def generate(payload: GenerateArt, user: User = Depends(get_current_user)):
    artifact = generate_artifact(payload.prompt, payload.kind)
    return {
        "id": artifact.id,
        "url": artifact.url,
        "kind": artifact.kind,
        "mode": artifact.mode,
        "note": (
            "Original procedural vector artwork generated locally from the prompt. "
            "No diffusion model was used and no third-party image service was called."
        ),
        "created_by": user.id,
    }


@router.get("/media/files/{filename}")
def serve(filename: str):
    if not SAFE_NAME.fullmatch(filename):
        raise HTTPException(status_code=404, detail="Not found.")
    path = media_path() / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Not found.")
    return FileResponse(
        path,
        media_type="image/svg+xml",
        headers={
            "Cache-Control": "private, max-age=86400",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
        },
    )
