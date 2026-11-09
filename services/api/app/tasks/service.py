"""Task planning and execution engine."""
from __future__ import annotations

import json
from urllib.parse import urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.base import AgentContext
from app.agents.planner import build_chat_plan
from app.database.models import (
    IntegrationAuditLog,
    IntegrationConnection,
    Task,
    TaskApproval,
    TaskExecutionLog,
    TaskStep,
    User,
    utcnow,
)
from app.orchestration.dispatcher import execute_agent


class TaskStateError(ValueError):
    pass


def create_task(db: Session, user: User, goal: str, *, title: str | None = None, conversation_id: str | None = None) -> Task:
    intent, plan = build_chat_plan(goal)
    requires_approval = intent.kind == "action"
    task = Task(
        user_id=user.id,
        conversation_id=conversation_id,
        title=(title or goal.strip()[:80] + ("…" if len(goal) > 80 else "")),
        goal=goal.strip(),
        status="waiting_approval" if requires_approval else "planned",
        risk="medium" if requires_approval else "low",
        requires_approval=requires_approval,
        meta={"intent": intent.kind, "confidence": intent.confidence, "rationale": intent.rationale},
    )
    db.add(task)
    db.flush()
    created_steps: list[TaskStep] = []
    for step in plan:
        row = TaskStep(
            task_id=task.id,
            position=step["position"],
            title=step["title"],
            description=step["description"],
            agent_id=step["agent_id"],
            status="pending",
        )
        created_steps.append(row)
        db.add(row)
    db.flush()  # assign IDs before wiring dependency edges
    for step in created_steps:
        step.depends_on = [created_steps[step.position - 1].id] if step.position > 0 else []
    if requires_approval:
        db.add(TaskApproval(task_id=task.id, user_id=user.id, action="execute task", status="pending"))
    db.add(TaskExecutionLog(task_id=task.id, message=f"Task planned with {len(plan)} steps."))
    db.commit()
    db.refresh(task)
    return task


def get_task(db: Session, user: User, task_id: str) -> Task | None:
    return db.scalar(select(Task).where(Task.id == task_id, Task.user_id == user.id))


def approve_task(db: Session, user: User, task: Task) -> Task:
    if not task.requires_approval:
        raise TaskStateError("This task does not require approval.")
    if task.status != "waiting_approval":
        raise TaskStateError(f"Task is '{task.status}' and cannot be approved now.")
    approvals = db.scalars(
        select(TaskApproval).where(TaskApproval.task_id == task.id, TaskApproval.status == "pending")
    ).all()
    for approval in approvals:
        approval.status = "approved"
        approval.decided_at = utcnow()
    task.status = "planned"
    db.add(TaskExecutionLog(task_id=task.id, message="User approved task execution."))
    db.commit()
    db.refresh(task)
    return task


def cancel_task(db: Session, user: User, task: Task) -> Task:
    if task.status in ("completed", "failed", "cancelled"):
        raise TaskStateError(f"Task is already {task.status}.")
    task.status = "cancelled"
    steps = db.scalars(select(TaskStep).where(TaskStep.task_id == task.id)).all()
    for step in steps:
        if step.status in ("pending", "running"):
            step.status = "cancelled"
    db.add(TaskExecutionLog(task_id=task.id, level="warning", message="Task cancelled by user."))
    db.commit()
    db.refresh(task)
    return task


async def _execute_webhook_task(db: Session, user: User, task: Task, action: dict) -> Task:
    connection = db.scalar(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user.id,
            IntegrationConnection.integration_key == "webhook",
            IntegrationConnection.status == "connected",
        )
    )
    steps = db.scalars(select(TaskStep).where(TaskStep.task_id == task.id).order_by(TaskStep.position)).all()
    if connection is None or not connection.encrypted_credentials:
        task.status = "failed"
        task.result = {"error": "No connected webhook is available."}
        db.add(TaskExecutionLog(task_id=task.id, level="error", message="Webhook is not connected."))
        db.commit()
        return task

    try:
        credentials = json.loads(connection.encrypted_credentials)
        url = credentials["url"]
        token = credentials.get("token") or ""
    except (ValueError, KeyError):
        task.status = "failed"
        task.result = {"error": "Stored webhook configuration is invalid."}
        db.add(TaskExecutionLog(task_id=task.id, level="error", message="Stored webhook configuration is invalid."))
        db.commit()
        return task

    headers = {"Content-Type": "application/json", "User-Agent": "ASTA/0.2 (approved action)"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    payload = action.get("payload") or {}
    log = TaskExecutionLog(task_id=task.id, message=f"Sending approved webhook payload to {urlparse(url).hostname}.")
    db.add(log)
    db.commit()

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=False) as client:
            response = await client.post(url, json=payload, headers=headers)
        outcome = "success" if 200 <= response.status_code < 300 else "failed"
        preview = response.text[:1000]
        task.result = {
            "webhook_status": response.status_code,
            "endpoint_host": urlparse(url).hostname,
            "response_preview": preview,
            "payload": payload,
        }
        task.status = "completed" if outcome == "success" else "failed"
        message = f"Webhook responded with HTTP {response.status_code}."
        level = "info" if outcome == "success" else "error"
    except httpx.HTTPError as exc:
        outcome = "failed"
        task.status = "failed"
        task.result = {"error": str(exc)[:300], "endpoint_host": urlparse(url).hostname, "payload": payload}
        message = f"Webhook request failed: {exc}"
        level = "error"

    for step in steps:
        step.status = "completed" if task.status == "completed" else "failed"
        step.output = message
        step.finished_at = utcnow()
    connection.last_used_at = utcnow()
    db.add(TaskExecutionLog(task_id=task.id, level=level, message=message))
    db.add(
        IntegrationAuditLog(
            user_id=user.id,
            integration_key="webhook",
            action="execute_action",
            outcome=outcome,
        )
    )
    db.commit()
    db.refresh(task)
    return task


async def execute_task(db: Session, user: User, task: Task) -> Task:
    if task.status == "waiting_approval":
        raise TaskStateError("This task requires explicit approval before execution.")
    if task.status not in ("planned", "draft", "failed"):
        raise TaskStateError(f"Task is '{task.status}' and cannot be executed.")
    task.status = "running"
    task.result = {}
    db.commit()

    action = (task.meta or {}).get("action")
    if isinstance(action, dict) and action.get("type") == "webhook":
        return await _execute_webhook_task(db, user, task, action)

    steps = db.scalars(select(TaskStep).where(TaskStep.task_id == task.id).order_by(TaskStep.position)).all()
    results: list[dict] = []
    try:
        for step in steps:
            step.status = "running"
            step.started_at = utcnow()
            db.add(TaskExecutionLog(task_id=task.id, step_id=step.id, message=f"Step started: {step.title}"))
            db.commit()

            if step.agent_id == "brain":
                step.output = "Handled by the Brain during conversation composition."
                step.status = "completed"
                step.finished_at = utcnow()
                db.add(TaskExecutionLog(task_id=task.id, step_id=step.id, message="Step completed by Brain."))
                db.commit()
                results.append({"step": step.title, "agent": "brain", "status": "completed"})
                continue

            ctx = AgentContext(
                user_id=user.id,
                conversation_id=task.conversation_id,
                text=task.goal,
                age_band=user.age_band,
                experience="work",
            )
            result = await execute_agent(step.agent_id, ctx, db, task_id=task.id)
            step.output = (result.summary + "\n\n" + result.details).strip()[:4000]
            step.status = "completed" if result.status in ("ok", "skipped") else result.status
            if result.status == "failed":
                step.error = result.details[:400]
            step.finished_at = utcnow()
            db.add(
                TaskExecutionLog(
                    task_id=task.id,
                    step_id=step.id,
                    level="info" if result.status != "failed" else "error",
                    message=f"Step {result.status}: {result.summary}",
                )
            )
            db.commit()
            results.append({"step": step.title, "agent": step.agent_id, "status": result.status, "summary": result.summary})
            if result.status == "failed":
                task.status = "failed"
                task.result = {"steps": results, "failed_at": step.title}
                db.commit()
                return task

        task.status = "completed"
        task.result = {"steps": results, "completed": True}
        db.add(TaskExecutionLog(task_id=task.id, message="Task completed."))
        db.commit()
        db.refresh(task)
        return task
    except Exception as exc:  # noqa: BLE001
        task.status = "failed"
        task.result = {"steps": results, "error": str(exc)[:300]}
        db.add(TaskExecutionLog(task_id=task.id, level="error", message=f"Task failed: {exc}"))
        db.commit()
        db.refresh(task)
        return task
