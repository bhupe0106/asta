"""Approved personal memory with full user control."""
from __future__ import annotations

import re

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database.models import MemoryAuditLog, MemoryItem, utcnow

STOPWORDS = {
    "the", "a", "an", "and", "or", "to", "of", "in", "for", "is", "are", "my", "me", "i",
    "why", "how", "what", "when", "where", "with", "you", "your", "about", "please", "can",
}


def _terms(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9']{3,}", text.lower()) if t not in STOPWORDS}


def recall(db: Session, user_id: str, query: str, limit: int = 6, workspace_id: str | None = None) -> list[str]:
    stmt = select(MemoryItem).where(
        MemoryItem.user_id == user_id,
        MemoryItem.approved.is_(True),
        MemoryItem.deleted_at.is_(None),
        MemoryItem.sensitivity == "normal",
        or_(MemoryItem.scope == "personal", MemoryItem.workspace_id == workspace_id),
    )
    items = db.scalars(stmt.order_by(MemoryItem.updated_at.desc()).limit(100)).all()
    if not items:
        return []
    wanted = _terms(query)
    scored: list[tuple[int, str]] = []
    for item in items:
        overlap = len(wanted & _terms(item.content))
        if overlap or not wanted:
            scored.append((overlap, item.content))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [content for _, content in scored[:limit]]


def create(
    db: Session,
    user_id: str,
    content: str,
    *,
    kind: str = "fact",
    scope: str = "personal",
    approved: bool = True,
    source: str = "user",
    workspace_id: str | None = None,
) -> MemoryItem:
    item = MemoryItem(
        user_id=user_id,
        content=content.strip(),
        kind=kind,
        scope=scope,
        approved=approved,
        source=source,
        workspace_id=workspace_id,
        sensitivity="normal",
    )
    db.add(item)
    db.flush()
    db.add(MemoryAuditLog(user_id=user_id, memory_id=item.id, action="created", detail={"approved": approved}))
    db.commit()
    db.refresh(item)
    return item


def list_items(db: Session, user_id: str, include_deleted: bool = False) -> list[MemoryItem]:
    stmt = select(MemoryItem).where(MemoryItem.user_id == user_id)
    if not include_deleted:
        stmt = stmt.where(MemoryItem.deleted_at.is_(None))
    return list(db.scalars(stmt.order_by(MemoryItem.created_at.desc())).all())


def update(db: Session, user_id: str, memory_id: str, *, content: str | None = None, kind: str | None = None, approved: bool | None = None) -> MemoryItem | None:
    item = db.scalar(
        select(MemoryItem).where(
            MemoryItem.id == memory_id,
            MemoryItem.user_id == user_id,
            MemoryItem.deleted_at.is_(None),
        )
    )
    if not item:
        return None
    if content is not None:
        item.content = content.strip()
    if kind is not None:
        item.kind = kind
    if approved is not None:
        item.approved = approved
    item.updated_at = utcnow()
    db.add(MemoryAuditLog(user_id=user_id, memory_id=item.id, action="updated", detail={}))
    db.commit()
    db.refresh(item)
    return item


def delete(db: Session, user_id: str, memory_id: str) -> bool:
    item = db.scalar(
        select(MemoryItem).where(
            MemoryItem.id == memory_id,
            MemoryItem.user_id == user_id,
            MemoryItem.deleted_at.is_(None),
        )
    )
    if not item:
        return False
    item.deleted_at = utcnow()
    db.add(MemoryAuditLog(user_id=user_id, memory_id=item.id, action="deleted", detail={}))
    db.commit()
    return True


def clear(db: Session, user_id: str) -> int:
    items = list_items(db, user_id)
    for item in items:
        item.deleted_at = utcnow()
    db.add(MemoryAuditLog(user_id=user_id, action="cleared", detail={"count": len(items)}))
    db.commit()
    return len(items)


def export(db: Session, user_id: str) -> dict:
    items = list_items(db, user_id)
    return {
        "exported_at": utcnow().isoformat() + "Z",
        "count": len(items),
        "memories": [
            {
                "id": i.id,
                "content": i.content,
                "kind": i.kind,
                "scope": i.scope,
                "approved": i.approved,
                "created_at": i.created_at.isoformat() + "Z",
            }
            for i in items
        ],
    }
