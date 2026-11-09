"""Agent inspection and direct execution."""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.base import AgentContext
from app.agents.guardian import scan_input
from app.ai.router import model_router
from app.core.deps import get_current_user, owned_conversation, rate_limit
from app.database.models import AgentExecution, AgentRecord, User, UserPreferences
from app.database.session import get_db
from app.orchestration.dispatcher import execute_agent
from app.orchestration.registry import AGENT_SPECS, registry
from app.schemas import AgentExecuteRequest, AgentOut

router = APIRouter(tags=["agents"])


def _spec_payload(spec, db: Session, user: User) -> dict:
    last = db.scalar(
        select(AgentExecution)
        .where(AgentExecution.agent_id == spec.id, AgentExecution.user_id == user.id)
        .order_by(AgentExecution.started_at.desc())
        .limit(1)
    )
    status = "available"
    if spec.id not in registry.ids() and spec.id != "brain":
        status = "unavailable"
    if last and last.status == "failed":
        status = "degraded"
    return {
        "id": spec.id,
        "name": spec.name,
        "role": spec.role,
        "description": spec.description,
        "responsibilities": list(spec.responsibilities),
        "allowed_tools": list(spec.allowed_tools),
        "permissions": list(spec.permissions),
        "status": status,
        "safety_requirements": list(spec.safety_requirements),
        "model_configuration": spec.model_configuration,
        "limits": spec.limits,
        "short": spec.short,
        "last_execution": (
            {"status": last.status, "latency_ms": last.latency_ms, "started_at": last.started_at}
            if last
            else None
        ),
    }


@router.get("/agents")
def list_agents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [_spec_payload(spec, db, user) for spec in AGENT_SPECS]


@router.get("/agents/{agent_id}")
def get_agent(agent_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    spec = registry.spec(agent_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Agent not found.")
    return _spec_payload(spec, db, user)


@router.get("/agents/{agent_id}/status")
async def agent_status(agent_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    spec = registry.spec(agent_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Agent not found.")
    executions = db.scalars(
        select(AgentExecution)
        .where(AgentExecution.agent_id == agent_id)
        .order_by(AgentExecution.started_at.desc())
        .limit(20)
    ).all()
    failures = sum(1 for e in executions if e.status == "failed")
    latencies = [e.latency_ms for e in executions if e.latency_ms]
    providers = await model_router.status()
    return {
        "agent_id": agent_id,
        "registered": agent_id in registry.ids() or agent_id == "brain",
        "status": "available" if not failures else ("degraded" if failures < 5 else "unhealthy"),
        "recent_executions": len(executions),
        "recent_failures": failures,
        "avg_latency_ms": round(sum(latencies) / len(latencies)) if latencies else 0,
        "providers": providers,
        "limits": spec.limits,
    }


@router.post("/agents/{agent_id}/execute")
async def run_agent(
    agent_id: str,
    payload: AgentExecuteRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rate_limit(request, "agent-execute", limit=20, window=60)
    if not registry.spec(agent_id) or agent_id in ("brain",):
        raise HTTPException(status_code=404, detail="Agent not found or not directly executable.")
    if not registry.get(agent_id):
        raise HTTPException(status_code=503, detail="This agent has no execution implementation registered.")
    if payload.conversation_id:
        owned_conversation(db, user, payload.conversation_id)

    assessment = scan_input(payload.input, age_band=user.age_band)
    if assessment.action == "block":
        return {"agent_id": "guardian", "status": "blocked", "summary": "Guardian blocked this request.", "details": assessment.user_message}
    if assessment.requires_approval:
        return {
            "agent_id": "guardian",
            "status": "needs_approval",
            "summary": "Guardian requires explicit approval before this agent runs.",
            "details": assessment.notes,
        }

    prefs = db.scalar(select(UserPreferences).where(UserPreferences.user_id == user.id))
    started = time.perf_counter()
    result = await execute_agent(
        agent_id,
        AgentContext(
            user_id=user.id,
            conversation_id=payload.conversation_id,
            text=payload.input,
            language=prefs.response_language if prefs else "en",
            age_band=user.age_band,
        ),
        db,
    )
    return {
        **result.to_dict(),
        "wall_ms": int((time.perf_counter() - started) * 1000),
    }


@router.get("/agents/executions/recent")
def recent_executions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(AgentExecution)
        .where(AgentExecution.user_id == user.id)
        .order_by(AgentExecution.started_at.desc())
        .limit(50)
    ).all()
    return [
        {
            "id": row.id,
            "agent_id": row.agent_id,
            "status": row.status,
            "summary": row.output_preview,
            "latency_ms": row.latency_ms,
            "started_at": row.started_at,
            "conversation_id": row.conversation_id,
        }
        for row in rows
    ]
