"""Chat attachment upload for PDF/DOCX/XLSX/CSV/TXT/MD/PPTX."""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import get_current_user
from app.database.models import Attachment, User
from app.database.session import get_db
from app.documents.extractor import ExtractionError, extract_text, summarise_structure, validate_upload
from app.schemas import MessageCreate
from sqlalchemy.orm import Session

router = APIRouter(tags=["attachments"])


@router.post("/attachments", status_code=201)
async def upload_attachment(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = await file.read()
    try:
        mime = validate_upload(file.filename or "upload", content, settings.max_upload_mb)
        text = extract_text(file.filename or "upload", content)
    except ExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    safe_name = f"{uuid.uuid4().hex}{Path(file.filename or 'upload').suffix.lower()}"
    target = settings.upload_path / safe_name
    target.write_bytes(content)

    attachment = Attachment(
        user_id=user.id,
        filename=(file.filename or "upload")[:255],
        content_type=mime,
        size_bytes=len(content),
        storage_path=str(target),
        extracted_text=text[:400_000],
        meta={"structure": summarise_structure(text), "scanner": "not_configured"},
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return {
        "id": attachment.id,
        "filename": attachment.filename,
        "content_type": attachment.content_type,
        "size_bytes": attachment.size_bytes,
        "preview": text[:400],
        "meta": attachment.meta,
    }


@router.delete("/attachments/{attachment_id}", status_code=204)
def delete_attachment(attachment_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from fastapi import Response

    attachment = db.scalar(select(Attachment).where(Attachment.id == attachment_id, Attachment.user_id == user.id))
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    try:
        Path(attachment.storage_path).unlink(missing_ok=True)
    except OSError:
        pass
    db.delete(attachment)
    db.commit()
    return Response(status_code=204)
