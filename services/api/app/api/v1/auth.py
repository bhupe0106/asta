"""Authentication and identity endpoints."""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, rate_limit
from app.core.security import create_access_token, hash_password, verify_password
from app.database.models import (
    AuditLog,
    Conversation,
    User,
    UserPreferences,
    UserProfile,
    UserSession,
    Workspace,
    WorkspaceMember,
    utcnow,
)
from app.database.session import get_db
from app.schemas import GuestRequest, LoginRequest, RegisterRequest, TokenResponse, UserOut

router = APIRouter(tags=["identity"])


def _issue_token(db: Session, user: User, request: Request) -> TokenResponse:
    session_row = UserSession(
        user_id=user.id,
        token_id=uuid.uuid4().hex,
        user_agent=(request.headers.get("user-agent") or "")[:250],
        expires_at=datetime.fromtimestamp(
            datetime.now(timezone.utc).timestamp() + settings.access_token_minutes * 60, tz=timezone.utc
        ).replace(tzinfo=None),
    )
    db.add(session_row)
    db.commit()
    token, expires_epoch = create_access_token(user.id, session_row.id, session_row.token_id)
    return TokenResponse(
        access_token=token,
        expires_at=datetime.fromtimestamp(expires_epoch, tz=timezone.utc),
        user=UserOut.model_validate(user),
    )


def _bootstrap_user(db: Session, user: User, *, guest: bool = False) -> None:
    db.add(UserProfile(user_id=user.id, locale="en"))
    db.add(UserPreferences(user_id=user.id))
    workspace = Workspace(name="Personal workspace", kind="personal", owner_id=user.id)
    db.add(workspace)
    db.flush()
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="owner"))
    conversation = Conversation(user_id=user.id, workspace_id=workspace.id, title="Welcome to ASTA", experience="companion")
    db.add(conversation)
    db.commit()


@router.post("/auth/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit(request, "register", limit=8, window=300)
    if not settings.enable_registration:
        raise HTTPException(status_code=403, detail="Registration is disabled on this deployment.")
    if payload.age_band == "child" and not payload.guardian_email:
        raise HTTPException(
            status_code=400,
            detail="Child accounts require a parent or guardian email for consent. "
            "Child-facing release additionally requires independent safety and legal review.",
        )
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip(),
        age_band=payload.age_band,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _bootstrap_user(db, user)
    db.add(AuditLog(user_id=user.id, action="auth.register", ip_address=request.client.host if request.client else None))
    db.commit()
    return _issue_token(db, user, request)


@router.post("/auth/guest", response_model=TokenResponse, status_code=201)
def guest(payload: GuestRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit(request, "guest", limit=6, window=300)
    if not settings.enable_registration:
        raise HTTPException(status_code=403, detail="Guest access is disabled on this deployment.")
    user = User(
        email=f"guest-{uuid.uuid4().hex[:16]}@local.asta",
        password_hash=hash_password(secrets.token_urlsafe(24)),
        display_name=payload.display_name.strip() or "Guest Traveler",
        age_band=payload.age_band,
        is_guest=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _bootstrap_user(db, user, guest=True)
    return _issue_token(db, user, request)


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit(request, "login", limit=10, window=300)
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    if not user.is_active or user.deleted_at is not None:
        raise HTTPException(status_code=403, detail="This account is not active.")
    db.add(AuditLog(user_id=user.id, action="auth.login", ip_address=request.client.host if request.client else None))
    db.commit()
    return _issue_token(db, user, request)


@router.post("/auth/logout")
def logout(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.core.security import decode_access_token

    header = request.headers.get("authorization", "")
    token = header.removeprefix("Bearer ").strip()
    payload = decode_access_token(token)
    if payload:
        session_row = db.scalar(select(UserSession).where(UserSession.token_id == payload["jti"]))
        if session_row:
            session_row.revoked_at = utcnow()
            db.commit()
    return {"ok": True}


@router.get("/users/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.delete("/users/me")
def delete_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Soft-delete the account, revoke sessions and detach private content."""
    user.deleted_at = utcnow()
    user.is_active = False
    sessions = db.scalars(select(UserSession).where(UserSession.user_id == user.id)).all()
    for session_row in sessions:
        session_row.revoked_at = utcnow()
    conversations = db.scalars(select(Conversation).where(Conversation.user_id == user.id)).all()
    for conversation in conversations:
        conversation.deleted_at = utcnow()
    db.add(AuditLog(user_id=user.id, action="account.delete_requested"))
    db.commit()
    return {"ok": True, "detail": "Account scheduled for deletion. Data retention policy applies to backups."}
