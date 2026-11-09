"""Typed agent contracts shared by every specialist."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.ai.providers.base import ChatMessage


class AgentInputError(ValueError):
    """Raised when an agent receives input outside its contract."""


@dataclass
class AgentContext:
    user_id: str
    conversation_id: str | None
    text: str
    language: str = "en"
    age_band: str = "adult"
    experience: str = "companion"
    attachment_text: str = ""
    memories: list[str] = field(default_factory=list)
    history: list[ChatMessage] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Citation:
    title: str
    url: str | None = None
    snippet: str | None = None
    verified: bool = False


@dataclass
class ToolRun:
    tool: str
    status: str
    detail: str = ""
    approval_required: bool = False


@dataclass
class AgentResult:
    agent_id: str
    status: str  # ok|skipped|failed|needs_approval
    summary: str
    details: str = ""
    citations: list[Citation] = field(default_factory=list)
    tool_runs: list[ToolRun] = field(default_factory=list)
    data: dict[str, Any] = field(default_factory=dict)
    latency_ms: int = 0
    model: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "status": self.status,
            "summary": self.summary,
            "details": self.details,
            "citations": [c.__dict__ for c in self.citations],
            "tool_runs": [t.__dict__ for t in self.tool_runs],
            "data": self.data,
            "latency_ms": self.latency_ms,
        }


class BaseAgent(ABC):
    """A specialist. Agents never delegate; only the Brain dispatches work."""

    id: str = "base"
    name: str = "Base Agent"
    role: str = "specialist"

    @abstractmethod
    async def run(self, ctx: AgentContext) -> AgentResult: ...

    def system_prompt(self, ctx: AgentContext) -> str:
        return ""
