"""ASTA Coder: static review plus opt-in best-effort Python execution."""
from __future__ import annotations

import re
import time

from app.agents.base import AgentContext, AgentResult, BaseAgent, ToolRun
from app.core.config import settings
from app.database.models import FeatureFlag
from app.database.session import SessionLocal
from app.tools.sandbox import ISOLATION, SandboxError, run_python

SECRET_PATTERN = re.compile(
    r"(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][A-Za-z0-9_\-]{10,}['\"]", re.IGNORECASE
)

CHECKS = (
    ("eval/exec usage", re.compile(r"\b(eval|exec)\s*\("), "Avoid dynamic evaluation on untrusted input."),
    ("shell=True", re.compile(r"shell\s*=\s*True"), "Shell injection risk; prefer argument lists."),
    ("bare except", re.compile(r"except\s*:"), "Catch specific exceptions so failures stay visible."),
    ("string-built SQL", re.compile(r"(SELECT|INSERT|UPDATE|DELETE).{0,40}(\+|%|\.format\()", re.IGNORECASE),
     "Use parameterised queries instead of string concatenation."),
    ("debug flag", re.compile(r"\bdebug\s*=\s*True"), "Disable debug mode in production."),
    ("TODO marker", re.compile(r"\b(TODO|FIXME)\b"), "Track unfinished work explicitly."),
)

RUN_PATTERN = re.compile(r"\b(run|execute|try it|test this|show the output|what does this print)\b", re.IGNORECASE)
FENCE_PATTERN = re.compile(r"```([A-Za-z0-9+#-]*)\s*\n(.*?)```", re.DOTALL)


def detect_language(text: str) -> str:
    signals = {
        "python": ("def ", "import ", "self.", "elif ", "__init__"),
        "typescript": ("interface ", ": string", "const ", "=>", "type "),
        "javascript": ("function ", "const ", "=>", "document."),
        "sql": ("select ", "from ", "where ", "join "),
        "rust": ("fn ", "let mut", "impl "),
        "go": ("func ", "package ", ":= "),
    }
    lowered = text.lower()
    best, score = "unknown", 0
    for lang, markers in signals.items():
        hits = sum(1 for m in markers if m.lower() in lowered)
        if hits > score:
            best, score = lang, hits
    return best


def _execution_enabled() -> bool:
    if not settings.sandbox_enabled:
        return False
    with SessionLocal() as db:
        flag = db.get(FeatureFlag, "sandboxed_code")
        return bool(flag and flag.enabled)


def _python_block(text: str) -> str | None:
    for language, code in FENCE_PATTERN.findall(text):
        if language.lower() in ("", "python", "py"):
            return code.strip()
    return None


class CoderAgent(BaseAgent):
    id = "coder"
    name = "ASTA Coder"
    role = "engineering"

    async def run(self, ctx: AgentContext) -> AgentResult:
        started = time.perf_counter()
        text = ctx.text
        language = detect_language(text)
        findings: list[str] = []
        for label, pattern, advice in CHECKS:
            if pattern.search(text):
                findings.append(f"- {label}: {advice}")
        if SECRET_PATTERN.search(text):
            findings.append("- possible hardcoded credential: remove it and load secrets from the environment.")

        has_code = bool(re.search(r"[{;()=]|def |class |function |select ", text, re.IGNORECASE))
        if not has_code:
            return AgentResult(
                agent_id=self.id,
                status="ok",
                summary="No code block detected; prepared an engineering guidance brief.",
                details=(
                    "Ask for the smallest reproducible snippet, the exact error and the expected behaviour. "
                    "For Python snippets, ask to run one and ASTA will use best-effort local execution."
                ),
                latency_ms=int((time.perf_counter() - started) * 1000),
            )

        review = (
            f"Detected language: {language}\n"
            "Static review:\n"
            + ("\n".join(findings) if findings else "- no common risky patterns found")
            + "\n\nRecommended next steps:\n"
            "1. Reproduce with the smallest input.\n"
            "2. Write a failing test.\n"
            "3. Apply the smallest fix.\n"
            "4. Run the full suite and a security pass."
        )

        code = _python_block(text)
        if code and RUN_PATTERN.search(text) and _execution_enabled():
            try:
                result = await run_python(code)
            except SandboxError as exc:
                return AgentResult(
                    agent_id=self.id,
                    status="failed",
                    summary="The code could not be executed.",
                    details=f"{review}\n\nExecution error: {exc}",
                    tool_runs=[ToolRun("code.sandbox", "failed", str(exc))],
                    latency_ms=int((time.perf_counter() - started) * 1000),
                )
            output = (
                f"{review}\n\n"
                f"Execution ({result['isolation']}):\n"
                f"status: {result['status']} · exit: {result.get('exit_code')}\n"
                f"stdout:\n{result['stdout'] or '(empty)'}\n"
                f"stderr:\n{result['stderr'] or '(empty)'}"
            )
            return AgentResult(
                agent_id=self.id,
                status="ok",
                summary=f"Reviewed and executed a Python snippet ({result['status']}).",
                details=output,
                tool_runs=[
                    ToolRun("code.static_analysis", "ok", f"{len(findings)} finding(s)"),
                    ToolRun("code.sandbox", result["status"], result["isolation"]),
                ],
                data={
                    "language": "python",
                    "findings": len(findings),
                    "executed": True,
                    "exit_code": result.get("exit_code"),
                    "isolation": ISOLATION,
                },
                latency_ms=int((time.perf_counter() - started) * 1000),
            )

        return AgentResult(
            agent_id=self.id,
            status="ok",
            summary=f"Static review of a {language} snippet completed with {len(findings)} finding(s).",
            details=(
                f"{review}\n\nExecution was not run. Include a fenced Python block and ask ASTA to run it; "
                "execution uses a best-effort local subprocess, not a hardened sandbox."
            ),
            tool_runs=[ToolRun("code.static_analysis", "ok", f"{len(findings)} finding(s)")],
            data={"language": language, "findings": len(findings), "executed": False},
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
