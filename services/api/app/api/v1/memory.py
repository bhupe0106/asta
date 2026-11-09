"""Approved memory management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.deps import ensure_preferences, get_current_user
from app.database.models import User
from app.database.session import get_db
from app.memory import service as memory_service
from app.schemas import MemoryCreate, MemoryOut, MemoryUpdate

router = APIRouter(tags=["memory"])


@router.get("/memory", response_model=list[MemoryOut])
def list_memory(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return memory_service.list_items(db, user.id)


@router.post("/memory", response_model=MemoryOut, status_code=201)
def create_memory(payload: MemoryCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prefs = ensure_preferences(db, user)
    if not prefs.memory_enabled:
        raise HTTPException(status_code=409, detail="Memory is disabled in your preferences.")
    return memory_service.create(db, user.id, payload.content, kind=payload.kind, scope=payload.scope)


@router.patch("/memory/{memory_id}", response_model=MemoryOut)
def update_memory(memory_id: str, payload: MemoryUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = memory_service.update(
        db, user.id, memory_id, content=payload.content, kind=payload.kind, approved=payload.approved
    )
    if not item:
        raise HTTPException(status_code=404, detail="Memory not found.")
    return item


@router.delete("/memory/{memory_id}", status_code=204)
def delete_memory(memory_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not memory_service.delete(db, user.id, memory_id):
        raise HTTPException(status_code=404, detail="Memory not found.")
    return Response(status_code=204)


@router.delete("/memory")
def clear_memory(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = memory_service.clear(db, user.id)
    return {"ok": True, "deleted": count}


@router.get("/memory/export")
def export_memory(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return memory_service.export(db, user.id)
