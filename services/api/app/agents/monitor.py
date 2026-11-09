"""ASTA Monitor: health reporting without reading conversation content."""
from __future__ import annotations

import platform
import time

from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.orchestration.registry import AGENT_SPECS


class MonitorAgent(BaseAgent):
    id = "monitor"
    name = "ASTA Monitor"
    role = "observability"

    async def run(self, ctx: AgentContext) -> AgentResult:
        started = time.perf_counter()
        from app.ai.router import model_router

        providers = await model_router.status()
        healthy = [p["key"] for p in providers if p["healthy"]]
        details = (
            f"Registered agents: {len(AGENT_SPECS)}\n"
            f"Healthy providers: {', '.join(healthy) or 'none'}\n"
            f"Runtime: Python {platform.python_version()} on {platform.system()}\n"
            "Telemetry stores latency and status only — never conversation content."
        )
        return AgentResult(
            agent_id=self.id,
            status="ok" if healthy else "skipped",
            summary=f"{len(healthy)} provider(s) healthy; {len(AGENT_SPECS)} agents registered.",
            details=details,
            data={"healthy_providers": healthy, "agents": len(AGENT_SPECS)},
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
