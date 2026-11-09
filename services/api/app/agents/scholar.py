"""ASTA Scholar: pedagogy scaffolding and age-aware difficulty."""
from __future__ import annotations

import time

from app.agents.base import AgentContext, AgentResult, BaseAgent


def _detect_subject(text: str) -> str:
    lowered = text.lower()
    subjects = {
        "mathematics": ("math", "algebra", "geometry", "calculus", "equation", "fraction", "integral"),
        "physics": ("physics", "force", "velocity", "energy", "quantum", "circuit"),
        "chemistry": ("chemistry", "molecule", "reaction", "atom", "acid", "bond"),
        "biology": ("biology", "cell", "dna", "organism", "evolution", "photosynthesis"),
        "programming": ("code", "python", "javascript", "algorithm", "loop", "function"),
        "language": ("grammar", "vocabulary", "translation", "speak", "language"),
        "history": ("history", "war", "revolution", "empire", "civilisation"),
    }
    for subject, words in subjects.items():
        if any(w in lowered for w in words):
            return subject
    return "general"


def _difficulty_for(age_band: str, text: str) -> str:
    lowered = text.lower()
    if any(w in lowered for w in ("advanced", "university", "proof", "derive", "exam")):
        return "advanced"
    if age_band == "child":
        return "foundational"
    if age_band == "teen":
        return "intermediate"
    return "adaptive"


class ScholarAgent(BaseAgent):
    id = "scholar"
    name = "ASTA Scholar"
    role = "education"

    async def run(self, ctx: AgentContext) -> AgentResult:
        started = time.perf_counter()
        subject = _detect_subject(ctx.text)
        difficulty = _difficulty_for(ctx.age_band, ctx.text)
        child_note = (
            "Use short sentences, one idea per step and a concrete everyday example. "
            "Invite the learner to try the next step themselves."
            if ctx.age_band == "child"
            else "Ask the learner to predict before revealing each step."
        )
        plan = [
            "Restate the question and confirm what is being asked.",
            "Identify the prerequisite ideas and check them briefly.",
            "Explain the reasoning one step at a time, with a worked example.",
            "Provide a similar practice problem without the answer.",
            "Summarise the transferable rule and a recall schedule.",
        ]
        details = (
            f"Subject: {subject}\nDifficulty: {difficulty}\nAge band: {ctx.age_band}\n"
            f"Pedagogy: {child_note}\n\nSuggested teaching sequence:\n"
            + "\n".join(f"{i}. {s}" for i, s in enumerate(plan, 1))
            + "\n\nGuardrail: guide the learner's reasoning; do not simply hand over homework answers."
        )
        return AgentResult(
            agent_id=self.id,
            status="ok",
            summary=f"Prepared an {difficulty} {subject} tutoring approach for a {ctx.age_band} learner.",
            details=details,
            data={"subject": subject, "difficulty": difficulty, "age_band": ctx.age_band},
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
