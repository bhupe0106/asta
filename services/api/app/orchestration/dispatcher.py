"""Agent dispatch with limits, timeouts and execution records."""
from __future__ import annotations

import asyncio
import logging
import time
import uuid

from sqlalchemy.orm import Session

from app.agents.base import AgentContext, AgentResult
from app.database.models import AgentExecution, utcnow
from app.orchestration.registry import registry

logger = logging.getLogger("asta.orchestrator")

DEFAULT_TIMEOUT = 30.0
MAX_DELEGATION_DEPTH = 2


class DispatchError(RuntimeError):
    pass


async def execute_agent(
    agent_id: str,
    ctx: AgentContext,
    db: Session,
    *,
    timeout: float | None = None,
    task_id: str | None = None,
    depth: int = 0,
) -> AgentResult:
    if depth > MAX_DELEGATION_DEPTH:
        raise DispatchError("Maximum delegation depth exceeded")
    agent = registry.get(agent_id)
    if agent is None:
        return AgentResult(
            agent_id=agent_id,
            status="failed",
            summary="Agent is not available.",
            details=f"No agent registered with id '{agent_id}'.",
        )

    spec = registry.spec(agent_id)
    limit = timeout or float((spec.limits if spec else {}).get("timeout_seconds", DEFAULT_TIMEOUT))
    execution = AgentExecution(
        id=str(uuid.uuid4()),
        task_id=task_id,
        conversation_id=ctx.conversation_id,
        user_id=ctx.user_id,
        agent_id=agent_id,
        status="running",
        input_preview=ctx.text[:280],
    )
    db.add(execution)
    db.commit()

    started = time.perf_counter()
    try:
        result = await asyncio.wait_for(agent.run(ctx), timeout=limit)
        result.latency_ms = result.latency_ms or int((time.perf_counter() - started) * 1000)
        execution.status = result.status
        execution.output_preview = (result.summary or "")[:400]
        execution.latency_ms = result.latency_ms
        execution.finished_at = utcnow()
        execution.meta = {"model": result.model, "data_keys": list(result.data)}
        db.commit()
        return result
    except asyncio.TimeoutError:
        execution.status = "failed"
        execution.error = f"Timed out after {limit:.0f}s"
        execution.finished_at = utcnow()
        db.commit()
        logger.warning("agent_timeout agent=%s conversation=%s", agent_id, ctx.conversation_id)
        return AgentResult(
            agent_id=agent_id,
            status="failed",
            summary="The specialist timed out, so its result was not used.",
            details=execution.error,
        )
    except Exception as exc:  # noqa: BLE001 - isolate one agent's failure from the turn
        execution.status = "failed"
        execution.error = str(exc)[:500]
        execution.finished_at = utcnow()
        db.commit()
        logger.exception("agent_failure agent=%s", agent_id)
        return AgentResult(
            agent_id=agent_id,
            status="failed",
            summary="The specialist failed, so its result was not used.",
            details=str(exc)[:300],
        )
