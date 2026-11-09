"""User preferences."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import ensure_preferences, get_current_user
from app.database.models import User
from app.database.session import get_db
from app.schemas import PreferencesOut, PreferencesUpdate

router = APIRouter(tags=["preferences"])


@router.get("/preferences", response_model=PreferencesOut)
def get_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ensure_preferences(db, user)


@router.patch("/preferences", response_model=PreferencesOut)
def update_preferences(payload: PreferencesUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prefs = ensure_preferences(db, user)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(prefs, field, value)
    db.commit()
    db.refresh(prefs)
    return prefs
