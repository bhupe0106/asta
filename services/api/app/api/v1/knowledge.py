"""Document upload, listing and retrieval."""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import get_current_user
from app.database.models import User
from app.database.session import SessionLocal, get_db
from app.documents.extractor import ExtractionError, extract_text, summarise_structure, validate_upload
from app.knowledge import service as knowledge_service
from app.schemas import KnowledgeDocumentOut, KnowledgeHit, KnowledgeSearchRequest
from sqlalchemy.orm import Session

router = APIRouter(tags=["knowledge"])


@router.get("/knowledge")
def list_knowledge(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    documents = knowledge_service.list_documents(db, user.id)
    total_chunks = 0
    for document in documents:
        total_chunks += 1
    return {
        "documents": [KnowledgeDocumentOut.model_validate(d).model_dump() for d in documents],
        "document_count": len(documents),
        "retrieval": "keyword",
        "vector_search_enabled": False,
        "note": "Retrieval uses transparent keyword scoring scoped to your account. Vector search is enabled only when document volume justifies it.",
    }


@router.post("/knowledge/documents", response_model=KnowledgeDocumentOut, status_code=201)
async def upload_document(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    content = await file.read()
    try:
        mime = validate_upload(file.filename or "upload", content, settings.max_upload_mb)
        text = extract_text(file.filename or "upload", content)
    except ExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    safe_name = f"{uuid.uuid4().hex}{Path(file.filename or 'upload').suffix.lower()}"
    target = settings.upload_path / safe_name
    target.write_bytes(content)

    db = SessionLocal()
    try:
        document = knowledge_service.ingest(
            db,
            user.id,
            title=file.filename or "Untitled document",
            text=text[:500_000],
            mime_type=mime,
            size_bytes=len(content),
        )
        document.status = "indexed"
        db.commit()
        db.refresh(document)
        return document
    finally:
        db.close()


@router.post("/knowledge/search", response_model=list[KnowledgeHit])
def search_knowledge(payload: KnowledgeSearchRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return knowledge_service.search(db, user.id, payload.query, limit=payload.limit)


@router.delete("/knowledge/{document_id}", status_code=204)
def delete_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from fastapi import Response

    if not knowledge_service.delete_document(db, user.id, document_id):
        raise HTTPException(status_code=404, detail="Document not found.")
    return Response(status_code=204)
