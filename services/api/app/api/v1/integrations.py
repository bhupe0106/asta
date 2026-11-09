"""Integration catalog and connection management.

OAuth connectors remain explicitly unavailable until real client credentials
exist. The one genuinely usable connector is a user-supplied webhook: ASTA
stores its URL and optional bearer token server-side, and every call is
approval-gated and audited.
"""
from __future__ import annotations

import json
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database.models import (
    FeatureFlag,
    Integration,
    IntegrationAuditLog,
    IntegrationConnection,
    Task,
    TaskApproval,
    TaskExecutionLog,
    User,
    utcnow,
)
from app.database.session import get_db

router = APIRouter(tags=["integrations"])


class WebhookConnect(BaseModel):
    url: str | None = Field(default=None, max_length=2000)
    token: str | None = Field(default=None, max_length=1000)


def _validate_webhook(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Webhook URL must be an absolute http(s) URL.")
    return url.strip()


@router.get("/integrations")
def list_integrations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    catalog = db.scalars(select(Integration).order_by(Integration.category, Integration.display_name)).all()
    connections = {
        row.integration_key: row
        for row in db.scalars(
            select(IntegrationConnection).where(
                IntegrationConnection.user_id == user.id,
                IntegrationConnection.status == "connected",
            )
        ).all()
    }
    flags = {flag.key: flag.enabled for flag in db.scalars(select(FeatureFlag)).all()}
    return {
        "external_actions_enabled": flags.get("external_actions", False),
        "integrations": [
            {
                "key": item.key,
                "display_name": item.display_name,
                "category": item.category,
                "description": item.description,
                "status": "available" if item.key == "webhook" else "not_configured",
                "requires_approval": True,
                "scopes": item.scopes,
                "connection": (
                    {
                        "id": connections[item.key].id,
                        "status": connections[item.key].status,
                        "connected_at": connections[item.key].created_at,
                    }
                    if item.key in connections
                    else None
                ),
            }
            for item in catalog
        ],
        "note": (
            "OAuth integrations remain unavailable until server-side credentials are configured. "
            "Custom webhooks are live: connect an HTTPS endpoint, then approve each action in Tasks."
        ),
    }


@router.post("/integrations/{provider}/connect")
def connect_integration(
    provider: str,
    payload: WebhookConnect | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    integration = db.scalar(select(Integration).where(Integration.key == provider))
    if not integration:
        raise HTTPException(status_code=404, detail="Unknown integration.")

    if provider != "webhook":
        db.add(
            IntegrationAuditLog(
                user_id=user.id,
                integration_key=provider,
                action="connect_attempt",
                outcome="not_configured",
            )
        )
        db.commit()
        raise HTTPException(
            status_code=501,
            detail=(
                f"{integration.display_name} OAuth credentials are not configured on this server. "
                "Set the provider's client ID and secret in the server environment, then restart. "
                "ASTA will never request your password for another service."
            ),
        )

    if payload is None or not payload.url:
        raise HTTPException(status_code=400, detail="A webhook URL is required.")
    url = _validate_webhook(payload.url)
    credentials = json.dumps({"url": url, "token": payload.token or ""}, ensure_ascii=False)

    connection = db.scalar(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user.id,
            IntegrationConnection.integration_key == provider,
        )
    )
    if connection is None:
        connection = IntegrationConnection(
            user_id=user.id,
            integration_key=provider,
            status="connected",
            encrypted_credentials=credentials,
            granted_scopes=["action.execute"],
        )
        db.add(connection)
    else:
        connection.status = "connected"
        connection.encrypted_credentials = credentials
        connection.granted_scopes = ["action.execute"]
        connection.last_used_at = utcnow()

    db.add(
        IntegrationAuditLog(
            user_id=user.id,
            integration_key=provider,
            action="connect",
            outcome="success",
        )
    )
    db.commit()
    db.refresh(connection)
    return {
        "ok": True,
        "connection": {
            "id": connection.id,
            "status": connection.status,
            "connected_at": connection.created_at,
            "url": url,
        },
        "note": (
            "The endpoint and token are stored server-side and never returned to the browser. "
            "Every payload requires explicit approval before it is sent."
        ),
    }


@router.post("/integrations/webhook/test", status_code=201)
def queue_webhook_action(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    flag = db.get(FeatureFlag, "external_actions")
    if not flag or not flag.enabled:
        raise HTTPException(status_code=503, detail="External actions are disabled on this deployment.")
    connection = db.scalar(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user.id,
            IntegrationConnection.integration_key == "webhook",
            IntegrationConnection.status == "connected",
        )
    )
    if not connection:
        raise HTTPException(status_code=409, detail="Connect a webhook first.")

    task = Task(
        user_id=user.id,
        title="Send an approved test payload to your webhook",
        goal="Send one test JSON payload to the connected webhook after explicit approval.",
        status="waiting_approval",
        risk="medium",
        requires_approval=True,
        meta={
            "integration": "webhook",
            "action": {
                "type": "webhook",
                "payload": {
                    "event": "asta.test",
                    "message": "Approved test payload from ASTA.",
                    "requested_at": utcnow().isoformat(),
                },
            },
        },
    )
    db.add(task)
    db.flush()
    db.add(TaskApproval(task_id=task.id, user_id=user.id, action="send webhook", status="pending"))
    db.add(TaskExecutionLog(task_id=task.id, message="Webhook action queued; waiting for explicit approval."))
    db.commit()
    return {
        "ok": True,
        "task_id": task.id,
        "status": task.status,
        "note": "Approve the task, then execute it. No network call has been made yet.",
    }


@router.delete("/integrations/{connection_id}")
def disconnect_integration(connection_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    connection = db.scalar(
        select(IntegrationConnection).where(
            IntegrationConnection.id == connection_id,
            IntegrationConnection.user_id == user.id,
        )
    )
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found.")
    connection.status = "revoked"
    connection.encrypted_credentials = None
    connection.last_used_at = utcnow()
    db.add(
        IntegrationAuditLog(
            user_id=user.id, integration_key=connection.integration_key, action="revoke", outcome="success"
        )
    )
    db.commit()
    return {"ok": True, "status": "revoked"}
