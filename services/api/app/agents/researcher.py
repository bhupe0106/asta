"""ASTA Researcher: real retrieval or an honest 'not configured' state."""
from __future__ import annotations

import time

from app.agents.base import AgentContext, AgentResult, BaseAgent, Citation, ToolRun
from app.tools.search import SearchUnavailable, enrich_with_pages, web_search


class ResearcherAgent(BaseAgent):
    id = "researcher"
    name = "ASTA Researcher"
    role = "research"

    async def run(self, ctx: AgentContext) -> AgentResult:
        started = time.perf_counter()
        query = ctx.text.strip()[:400]
        try:
            results = await web_search(query, limit=5)
        except SearchUnavailable as exc:
            return AgentResult(
                agent_id=self.id,
                status="skipped",
                summary="Web research is unavailable on this deployment.",
                details=str(exc),
                tool_runs=[ToolRun("search.web", "unavailable", str(exc))],
                latency_ms=int((time.perf_counter() - started) * 1000),
            )
        except Exception as exc:  # defensive: never fabricate on failure
            return AgentResult(
                agent_id=self.id,
                status="failed",
                summary="The search provider failed, so no sources were used.",
                details=str(exc),
                tool_runs=[ToolRun("search.web", "failed", str(exc))],
                latency_ms=int((time.perf_counter() - started) * 1000),
            )

        enriched = await enrich_with_pages(results, limit=3)
        citations: list[Citation] = []
        brief_lines = ["Retrieved results (external content is treated as untrusted data):"]
        for item in enriched:
            citations.append(
                Citation(
                    title=item["title"],
                    url=item["url"],
                    snippet=(item["excerpt"] or item["snippet"])[:600],
                    verified=bool(item["excerpt"]),
                )
            )
            brief_lines.append(f"- {item['title']} — {item['url']}")
            if item["excerpt"]:
                brief_lines.append(f"  Excerpt: {item['excerpt'][:900]}")
            elif item["error"]:
                brief_lines.append(f"  Page not opened: {item['error']}")

        for result in results[3:]:
            citations.append(
                Citation(title=result.title, url=result.url, snippet=result.snippet, verified=False)
            )
            brief_lines.append(f"- {result.title} — {result.url}")

        opened = sum(1 for item in enriched if item["excerpt"])
        return AgentResult(
            agent_id=self.id,
            status="ok",
            summary=f"Retrieved {len(citations)} source(s); opened {opened} page(s) for evidence.",
            details="\n".join(brief_lines),
            citations=citations,
            tool_runs=[
                ToolRun("search.web", "ok", f"{len(results)} results"),
                ToolRun("fetch.web", "ok" if opened else "unavailable", f"{opened} page(s) opened"),
            ],
            data={"query": query, "opened": opened},
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
