"""ASTA Memory: recall scope and memory proposals (DB work happens in service layer)."""
from __future__ import annotations

import re
import time

from app.agents.base import AgentContext, AgentResult, BaseAgent

REMEMBER = re.compile(r"\b(remember|note that|keep in mind|save this)\b[:\s]*(.+)", re.IGNORECASE)


class MemoryAgent(BaseAgent):
    id = "memory"
    name = "ASTA Memory"
    role = "knowledge"

    async def run(self, ctx: AgentContext) -> AgentResult:
        started = time.perf_counter()
        match = REMEMBER.search(ctx.text)
        proposal = match.group(2).strip()[:500] if match else None
        recalled = ctx.memories[:8]
        details_lines: list[str] = []
        if recalled:
            details_lines.append("Approved memories available for this turn:")
            details_lines += [f"- {m}" for m in recalled]
        else:
            details_lines.append("No approved personal memories matched this request.")
        if proposal:
            details_lines.append(
                f"\nProposed memory (awaiting your approval): {proposal}"
            )
        return AgentResult(
            agent_id=self.id,
            status="ok",
            summary=(
                f"Recalled {len(recalled)} approved memory item(s)."
                + (" A new memory was proposed for approval." if proposal else "")
            ),
            details="\n".join(details_lines),
            data={"recalled": len(recalled), "proposal": proposal, "auto_stored": False},
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
