"""ASTA Planner: deterministic, inspectable goal decomposition."""
from __future__ import annotations

import time
from dataclasses import dataclass

from app.agents.base import AgentContext, AgentResult, BaseAgent


@dataclass
class Intent:
    kind: str
    agents: list[str]
    confidence: float
    rationale: str


KEYWORDS: dict[str, tuple[str, ...]] = {
    "research": ("research", "source", "cite", "citation", "evidence", "study", "latest", "news", "compare"),
    "learn": ("learn", "teach", "explain", "study", "exam", "quiz", "homework", "math", "physics", "chemistry", "biology", "grammar", "practice"),
    "code": ("code", "bug", "debug", "function", "api", "sql", "python", "javascript", "typescript", "react", "compile", "stack trace"),
    "data": ("csv", "spreadsheet", "excel", "dataset", "analyse", "analyze", "statistics", "trend", "chart", "report"),
    "create": ("write", "story", "poem", "script", "caption", "brand", "marketing", "presentation", "design", "brainstorm",
               "image", "picture", "illustration", "draw", "logo", "poster", "artwork", "sigil", "video", "animation"),
    "plan": ("plan", "roadmap", "schedule", "project", "steps", "organise", "organize", "checklist", "goal"),
    "voice": ("speak", "voice", "listen", "microphone", "pronounce", "audio"),
    "action": ("send", "email", "delete", "purchase", "publish", "post", "book", "transfer", "share"),
}

EXPERIENCE_HINTS = {
    "learn": "learn",
    "work": "plan",
    "create": "create",
    "companion": "general",
}


def classify_intent(text: str, experience: str = "companion") -> Intent:
    lowered = text.lower()
    scores: dict[str, int] = {}
    for kind, words in KEYWORDS.items():
        score = sum(1 for w in words if w in lowered)
        if score:
            scores[kind] = score
    if not scores:
        hint = EXPERIENCE_HINTS.get(experience, "general")
        if hint != "general" and hint in KEYWORDS:
            return Intent(kind=hint, agents=["brain", hint if hint != "action" else "operator"], confidence=0.45,
                          rationale=f"No strong intent signal; using the {experience} workspace default.")
        return Intent(kind="general", agents=["brain"], confidence=0.35,
                      rationale="General conversation; the Brain answers directly.")

    kind, top_score = max(scores.items(), key=lambda kv: kv[1])
    total = sum(scores.values())
    confidence = round(min(0.95, 0.5 + (top_score / max(total, 1)) * 0.45), 2)
    agent_map = {
        "research": ["researcher", "memory"],
        "learn": ["scholar", "memory"],
        "code": ["coder"],
        "data": ["analyst", "memory"],
        "create": ["creator"],
        "plan": ["planner", "memory"],
        "voice": ["voice"],
        "action": ["operator", "guardian"],
    }
    agents = agent_map.get(kind, ["brain"])
    if kind in ("research", "learn"):
        agents.append("guardian")
    return Intent(kind=kind, agents=agents, confidence=confidence,
                  rationale=f"Detected {kind} intent from {top_score} keyword signal(s).")


PLAN_TEMPLATES: dict[str, list[tuple[str, str, str]]] = {
    "research": [
        ("Clarify the question", "State the exact question, scope and freshness requirement.", "brain"),
        ("Retrieve evidence", "Run configured search and knowledge retrieval.", "researcher"),
        ("Verify sources", "Check independence, dates and corroboration.", "researcher"),
        ("Synthesize", "Separate verified facts from interpretation and cite claims.", "brain"),
    ],
    "learn": [
        ("Diagnose prior knowledge", "Identify prerequisites and current level.", "scholar"),
        ("Explain step by step", "Build understanding with a worked example.", "scholar"),
        ("Practise", "Generate an unsolved problem and wait for the learner.", "scholar"),
        ("Recall plan", "Schedule spaced review and summarise the rule.", "scholar"),
    ],
    "code": [
        ("Understand the problem", "Collect the smallest repro, expected and actual behaviour.", "brain"),
        ("Static review", "Check risky patterns and likely fault lines.", "coder"),
        ("Fix and test", "Apply the smallest change and add a regression test.", "coder"),
        ("Verify", "Run tests and review security implications.", "coder"),
    ],
    "data": [
        ("Validate input", "Check schema, types, missing values and duplicates.", "analyst"),
        ("Profile data", "Compute descriptive statistics locally.", "analyst"),
        ("Interpret", "Describe patterns and uncertainty without overclaiming.", "brain"),
        ("Report", "Produce a concise summary with assumptions.", "analyst"),
    ],
    "create": [
        ("Define the brief", "Audience, tone, length and desired action.", "creator"),
        ("Draft", "Produce original work with one clear core idea.", "creator"),
        ("Critique", "Cut filler and check clarity and rights.", "creator"),
        ("Finalise", "Format for the target channel.", "brain"),
    ],
    "plan": [
        ("Define the outcome", "Write a measurable finish line.", "planner"),
        ("Map dependencies", "List prerequisites and risks.", "planner"),
        ("Sequence steps", "Order work so each step is checkable.", "planner"),
        ("Assign and track", "Assign specialists and track status.", "brain"),
    ],
    "action": [
        ("Classify action", "Determine impact and required permissions.", "guardian"),
        ("Check approval", "Request explicit user approval before execution.", "operator"),
        ("Execute", "Run only after approval; log the action.", "operator"),
        ("Verify", "Confirm the external outcome before reporting success.", "operator"),
    ],
    "general": [
        ("Understand", "Parse the request and relevant context.", "brain"),
        ("Recall", "Retrieve approved memories and knowledge.", "memory"),
        ("Respond", "Compose a direct, honest answer.", "brain"),
    ],
    "voice": [
        ("Check permission", "Microphone access is requested by the browser, never assumed.", "voice"),
        ("Listen", "Capture speech with visible recording status.", "voice"),
        ("Respond", "Speak the answer with the configured voice.", "voice"),
    ],
}


def build_chat_plan(text: str, experience: str = "companion") -> tuple[Intent, list[dict]]:
    intent = classify_intent(text, experience)
    template = PLAN_TEMPLATES.get(intent.kind, PLAN_TEMPLATES["general"])
    steps = [
        {"position": i, "title": title, "description": description, "agent_id": agent, "status": "pending"}
        for i, (title, description, agent) in enumerate(template)
    ]
    if intent.kind in ("research", "learn", "code", "data", "create", "plan", "action"):
        steps.insert(1, {
            "position": 1,
            "title": "Safety and permission review",
            "description": "Guardian classifies risk before any tool or delegated work.",
            "agent_id": "guardian",
            "status": "pending",
        })
    return intent, steps


class PlannerAgent(BaseAgent):
    id = "planner"
    name = "ASTA Planner"
    role = "planning"

    async def run(self, ctx: AgentContext) -> AgentResult:
        started = time.perf_counter()
        intent, steps = build_chat_plan(ctx.text, ctx.experience)
        listing = "\n".join(f"{i+1}. {s['title']} — {s['agent_id']}" for i, s in enumerate(steps))
        return AgentResult(
            agent_id=self.id,
            status="ok",
            summary=f"Planned {len(steps)} steps for a {intent.kind} request.",
            details=f"Intent: {intent.kind} (confidence {intent.confidence})\n\n{listing}",
            data={"intent": intent.__dict__, "steps": steps},
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
