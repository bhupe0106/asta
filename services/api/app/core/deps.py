"""Request dependencies: auth, rate limiting, resource ownership."""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database.models import Conversation, User, UserSession, utcnow
from app.database.session import get_db
from app.database.models import new_id

bearer = HTTPBearer(auto_error=False)

_RATE_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


def rate_limit(request: Request, key: str, limit: int = 30, window: float = 60.0) -> None:
    """In-process sliding window.

    Adequate for a single instance; a shared Redis backend is the documented
    upgrade path for multi-instance deployments.
    """
    client = request.client.host if request.client else "unknown"
    bucket_key = f"{key}:{client}"
    now = time.monotonic()
    bucket = _RATE_BUCKETS[bucket_key]
    while bucket and now - bucket[0] > window:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment and try again.")
    bucket.append(now)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")
    session = db.scalar(select(UserSession).where(UserSession.token_id == payload["jti"]))
    if not session or session.revoked_at is not None or session.expires_at < utcnow():
        raise HTTPException(status_code=401, detail="This session is no longer valid.")
    user = db.get(User, payload["sub"])
    if not user or not user.is_active or user.deleted_at is not None:
        raise HTTPException(status_code=401, detail="Account unavailable.")
    return user


def owned_conversation(db: Session, user: User, conversation_id: str) -> Conversation:
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user.id,
            Conversation.deleted_at.is_(None),
        )
    )
    if not conversation:
        # 404 rather than 403 so IDs cannot be probed across tenants.
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conversation


def ensure_preferences(db: Session, user: User):
    from app.database.models import UserPreferences

    prefs = db.scalar(select(UserPreferences).where(UserPreferences.user_id == user.id))
    if prefs is None:
        prefs = UserPreferences(id=new_id(), user_id=user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs
