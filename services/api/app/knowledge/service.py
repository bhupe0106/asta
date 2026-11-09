"""Workspace/user-scoped knowledge ingestion and keyword retrieval.

Vector search is intentionally deferred until it is justified; this module
scores chunks with a transparent term-frequency heuristic and always filters by
owner before reading anything.
"""
from __future__ import annotations

import math
import re
from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import DocumentChunk, KnowledgeBase, KnowledgeDocument, utcnow

CHUNK_SIZE = 900
CHUNK_OVERLAP = 120


def _terms(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']{2,}", text.lower())


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    clean = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not clean:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(clean):
        end = min(len(clean), start + size)
        if end < len(clean):
            boundary = clean.rfind("\n", start + size // 2, end)
            if boundary > start:
                end = boundary
        chunks.append(clean[start:end].strip())
        if end >= len(clean):
            break
        start = max(end - overlap, start + 1)
    return [c for c in chunks if c]


def ensure_default_base(db: Session, user_id: str, workspace_id: str | None = None) -> KnowledgeBase:
    stmt = select(KnowledgeBase).where(
        KnowledgeBase.user_id == user_id,
        KnowledgeBase.workspace_id == workspace_id,
        KnowledgeBase.deleted_at.is_(None),
    )
    base = db.scalar(stmt)
    if base:
        return base
    base = KnowledgeBase(user_id=user_id, workspace_id=workspace_id, name="Personal knowledge", description="Default knowledge base")
    db.add(base)
    db.commit()
    db.refresh(base)
    return base


def ingest(
    db: Session,
    user_id: str,
    *,
    title: str,
    text: str,
    mime_type: str,
    size_bytes: int,
    attachment_id: str | None = None,
) -> KnowledgeDocument:
    base = ensure_default_base(db, user_id)
    document = KnowledgeDocument(
        knowledge_base_id=base.id,
        user_id=user_id,
        attachment_id=attachment_id,
        title=title[:255],
        mime_type=mime_type,
        size_bytes=size_bytes,
        status="indexed",
    )
    db.add(document)
    db.flush()
    for position, chunk in enumerate(chunk_text(text)):
        db.add(
            DocumentChunk(
                document_id=document.id,
                position=position,
                content=chunk,
                token_estimate=max(1, len(chunk) // 4),
            )
        )
    db.commit()
    db.refresh(document)
    return document


def list_documents(db: Session, user_id: str) -> list[KnowledgeDocument]:
    return list(
        db.scalars(
            select(KnowledgeDocument)
            .where(KnowledgeDocument.user_id == user_id, KnowledgeDocument.deleted_at.is_(None))
            .order_by(KnowledgeDocument.created_at.desc())
        ).all()
    )


def delete_document(db: Session, user_id: str, document_id: str) -> bool:
    document = db.scalar(
        select(KnowledgeDocument).where(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.user_id == user_id,
            KnowledgeDocument.deleted_at.is_(None),
        )
    )
    if not document:
        return False
    document.deleted_at = utcnow()
    db.commit()
    return True


def search(db: Session, user_id: str, query: str, limit: int = 5) -> list[dict]:
    wanted = _terms(query)
    if not wanted:
        return []
    rows = db.execute(
        select(DocumentChunk, KnowledgeDocument)
        .join(KnowledgeDocument, DocumentChunk.document_id == KnowledgeDocument.id)
        .where(
            KnowledgeDocument.user_id == user_id,
            KnowledgeDocument.deleted_at.is_(None),
        )
        .limit(400)
    ).all()
    if not rows:
        return []

    query_counts = Counter(wanted)
    hits: list[dict] = []
    for chunk, document in rows:
        chunk_terms = Counter(_terms(chunk.content))
        overlap = sum(min(count, chunk_terms.get(term, 0)) for term, count in query_counts.items())
        if overlap == 0:
            continue
        length_norm = 1 + math.log(1 + sum(chunk_terms.values()))
        score = overlap / length_norm
        hits.append(
            {
                "document_id": document.id,
                "document_title": document.title,
                "chunk": chunk.content[:600],
                "score": round(score, 4),
            }
        )
    hits.sort(key=lambda h: h["score"], reverse=True)
    return hits[:limit]
