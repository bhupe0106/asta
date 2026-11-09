"""Task API."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database.models import Task, TaskExecutionLog, TaskStep, User
from app.database.session import get_db
from app.schemas import TaskCreate, TaskOut, TaskStepOut
from app.tasks import service as task_service

router = APIRouter(tags=["tasks"])


def _serialise(db: Session, task: Task) -> dict:
    steps = db.scalars(select(TaskStep).where(TaskStep.task_id == task.id).order_by(TaskStep.position)).all()
    payload = TaskOut.model_validate(task).model_dump()
    payload["steps"] = [TaskStepOut.model_validate(step).model_dump() for step in steps]
    return payload


@router.post("/tasks", response_model=TaskOut, status_code=201)
async def create_task(payload: TaskCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = task_service.create_task(db, user, payload.goal, title=payload.title, conversation_id=payload.conversation_id)
    if payload.auto_execute and not task.requires_approval:
        task = await task_service.execute_task(db, user, task)
    return _serialise(db, task)


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(status: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Task).where(Task.user_id == user.id)
    if status:
        stmt = stmt.where(Task.status == status)
    tasks = db.scalars(stmt.order_by(Task.updated_at.desc()).limit(100)).all()
    return [_serialise(db, task) for task in tasks]


@router.get("/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = task_service.get_task(db, user, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return _serialise(db, task)


@router.post("/tasks/{task_id}/cancel", response_model=TaskOut)
def cancel_task(task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = task_service.get_task(db, user, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    try:
        task = task_service.cancel_task(db, user, task)
    except task_service.TaskStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _serialise(db, task)


@router.post("/tasks/{task_id}/approve", response_model=TaskOut)
def approve_task(task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = task_service.get_task(db, user, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    try:
        task = task_service.approve_task(db, user, task)
    except task_service.TaskStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _serialise(db, task)


@router.post("/tasks/{task_id}/execute", response_model=TaskOut)
async def execute_task(task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = task_service.get_task(db, user, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    try:
        task = await task_service.execute_task(db, user, task)
    except task_service.TaskStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _serialise(db, task)


@router.get("/tasks/{task_id}/logs")
def task_logs(task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = task_service.get_task(db, user, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    logs = db.scalars(
        select(TaskExecutionLog).where(TaskExecutionLog.task_id == task_id).order_by(TaskExecutionLog.created_at.asc())
    ).all()
    return [
        {"id": log.id, "level": log.level, "message": log.message, "step_id": log.step_id, "created_at": log.created_at}
        for log in logs
    ]
