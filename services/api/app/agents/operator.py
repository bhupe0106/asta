"""ASTA Operator: prepares permissioned actions; never executes silently."""
from __future__ import annotations

import re
import time

from app.agents.base import AgentContext, AgentResult, BaseAgent, ToolRun

ACTION_PATTERN = re.compile(
    r"\b(send|email|delete|remove|purchase|buy|publish|post|schedule|book|transfer|share)\b",
    re.IGNORECASE,
)


class OperatorAgent(BaseAgent):
    id = "operator"
    name = "ASTA Operator"
    role = "automation"

    async def run(self, ctx: AgentContext) -> AgentResult:
        started = time.perf_counter()
        match = ACTION_PATTERN.search(ctx.text)
        connected = False  # No external integrations are configured by default.

        if match and not connected:
            return AgentResult(
                agent_id=self.id,
                status="needs_approval",
                summary=(
                    "A consequential action was requested, but no external integration is "
                    "connected. Nothing has been executed."
                ),
                details=(
                    f"Detected action: '{match.group(1)}'. Connect an integration in Settings and "
                    "grant least-privilege scopes before ASTA can act on your behalf. Every "
                    "action will require your explicit approval and will be written to the audit log."
                ),
                tool_runs=[ToolRun("integration.execute", "blocked", "No integration connected", True)],
                latency_ms=int((time.perf_counter() - started) * 1000),
            )

        return AgentResult(
            agent_id=self.id,
            status="ok",
            summary="No external action was executed. Internal tasks can be planned with approval.",
            details=(
                "ASTA can create an inspectable task plan. Actions that change external systems "
                "remain blocked until you connect an integration and approve each action."
            ),
            data={"connected_integrations": 0, "action_executed": False},
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
