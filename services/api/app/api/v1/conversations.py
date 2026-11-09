"""Conversation and streaming chat endpoints."""
from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, owned_conversation, rate_limit
from app.database.models import Attachment, Conversation, Message, User, UserPreferences, Workspace, utcnow
from app.database.session import SessionLocal, get_db
from app.orchestration.brain import stream_turn
from app.schemas import (
    ConversationCreate,
    ConversationOut,
    ConversationUpdate,
    FeedbackCreate,
    MessageCreate,
    MessageOut,
)

router = APIRouter(tags=["conversations"])


def _default_workspace(db: Session, user: User) -> str | None:
    workspace = db.scalar(select(Workspace).where(Workspace.owner_id == user.id, Workspace.kind == "personal"))
    return workspace.id if workspace else None


@router.post("/conversations", response_model=ConversationOut, status_code=201)
def create_conversation(payload: ConversationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = Conversation(
        user_id=user.id,
        workspace_id=_default_workspace(db, user),
        title=payload.title or "New conversation",
        experience=payload.experience,
        language=payload.language,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    archived: bool = False,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 200))
    rows = db.scalars(
        select(Conversation)
        .where(
            Conversation.user_id == user.id,
            Conversation.deleted_at.is_(None),
            Conversation.archived.is_(archived),
        )
        .order_by(Conversation.pinned.desc(), Conversation.updated_at.desc())
        .limit(limit)
    ).all()
    return rows


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return owned_conversation(db, user, conversation_id)


@router.patch("/conversations/{conversation_id}", response_model=ConversationOut)
def update_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = owned_conversation(db, user, conversation_id)
    if payload.title is not None:
        conversation.title = payload.title.strip() or "New conversation"
    if payload.pinned is not None:
        conversation.pinned = payload.pinned
    if payload.archived is not None:
        conversation.archived = payload.archived
    conversation.updated_at = utcnow()
    db.commit()
    db.refresh(conversation)
    return conversation


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = owned_conversation(db, user, conversation_id)
    conversation.deleted_at = utcnow()
    db.commit()
    return {"ok": True}


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
def list_messages(conversation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_conversation(db, user, conversation_id)
    rows = db.scalars(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.asc())
    ).all()
    return rows


@router.post("/conversations/{conversation_id}/messages/stream")
async def stream_message(
    conversation_id: str,
    payload: MessageCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rate_limit(request, "chat", limit=40, window=60)
    owned_conversation(db, user, conversation_id)

    attachment_texts: list[str] = []
    attachment_names: list[str] = []
    for attachment_id in payload.attachment_ids[:5]:
        attachment = db.scalar(
            select(Attachment).where(Attachment.id == attachment_id, Attachment.user_id == user.id)
        )
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found.")
        attachment_names.append(attachment.filename)
        if attachment.extracted_text:
            attachment_texts.append(f"[{attachment.filename}]\n{attachment.extracted_text}")

    combined = "\n\n".join(attachment_texts)[:120_000]
    user_id = user.id
    language = payload.language

    async def generator() -> AsyncIterator[str]:
        session = SessionLocal()
        try:
            turn_user = session.get(User, user_id)
            conversation = session.get(Conversation, conversation_id)
            if not turn_user or not conversation:
                yield 'event: error\ndata: {"message":"Conversation unavailable"}\n\n'
                return
            prefs = session.scalar(select(UserPreferences).where(UserPreferences.user_id == user_id))
            effective_language = language or (prefs.response_language if prefs else None)
            async for frame in stream_turn(
                session,
                turn_user,
                conversation,
                payload.content,
                language=None if effective_language == "auto" else effective_language,
                attachment_text=combined,
                attachment_names=attachment_names,
            ):
                if await request.is_disconnected():
                    break
                yield frame
        except Exception as exc:  # noqa: BLE001
            import logging

            logging.getLogger("asta.stream").exception("stream_failed")
            yield f'event: error\ndata: {{"message":"The stream failed.","detail":"{str(exc)[:200]}"}}\n\n'
        finally:
            session.close()

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/messages/{message_id}/feedback", status_code=201)
def feedback(
    message_id: str,
    payload: FeedbackCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.database.models import MessageFeedback

    message = db.get(Message, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found.")
    owned_conversation(db, user, message.conversation_id)
    row = MessageFeedback(message_id=message_id, user_id=user.id, rating=payload.rating, comment=payload.comment)
    db.add(row)
    db.commit()
    return {"ok": True, "id": row.id}
