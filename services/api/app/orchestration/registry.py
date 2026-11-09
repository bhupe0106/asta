"""Specialist agent registry.

The registry is the single source of truth for what each agent is allowed to
do, which tools it may call and what the UI is allowed to display.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # avoid importing the agents package during registry bootstrap
    from app.agents.base import BaseAgent


@dataclass(frozen=True)
class AgentSpec:
    id: str
    name: str
    role: str
    short: str
    description: str
    responsibilities: tuple[str, ...]
    allowed_tools: tuple[str, ...] = ()
    permissions: tuple[str, ...] = ()
    safety_requirements: tuple[str, ...] = ()
    model_configuration: dict = field(default_factory=dict)
    limits: dict = field(default_factory=dict)
    primary: bool = False


AGENT_SPECS: tuple[AgentSpec, ...] = (
    AgentSpec(
        id="brain",
        name="ASTA Brain",
        role="orchestrator",
        short="Understands you, plans, delegates and answers.",
        description=(
            "The primary user-facing intelligence. Classifies intent, builds an "
            "execution plan, dispatches specialists, validates their output and "
            "composes the final response."
        ),
        responsibilities=(
            "Understand requests and context",
            "Classify intent and select specialists",
            "Plan and delegate execution",
            "Validate specialist results",
            "Communicate progress and failures",
            "Compose the final answer",
        ),
        allowed_tools=("memory.recall", "task.plan", "agent.dispatch"),
        permissions=("conversation.read", "conversation.write", "agent.invoke"),
        safety_requirements=("Guardian review before consequential tools", "Never claim unverified execution"),
        model_configuration={"profile": "general", "local_first": True},
        limits={"max_delegation_depth": 2, "max_steps": 8},
        primary=True,
    ),
    AgentSpec(
        id="researcher",
        name="ASTA Researcher",
        role="research",
        short="Finds and verifies sources.",
        description="Retrieval, source verification, comparison and citation management.",
        responsibilities=(
            "Web and document retrieval",
            "Source verification",
            "Evidence comparison",
            "Citation management",
        ),
        allowed_tools=("search.web", "knowledge.search"),
        permissions=("knowledge.read", "network.search"),
        safety_requirements=("External content is untrusted input", "Never fabricate a citation"),
        model_configuration={"profile": "research", "temperature": 0.2},
        limits={"timeout_seconds": 25, "max_sources": 6},
    ),
    AgentSpec(
        id="scholar",
        name="ASTA Scholar",
        role="education",
        short="Teaches step by step.",
        description="Adaptive tutoring, worked examples, quizzes and study planning.",
        responsibilities=(
            "Personalised teaching",
            "Step-by-step explanation",
            "Quiz and practice generation",
            "Difficulty adaptation",
        ),
        allowed_tools=("memory.recall", "knowledge.search", "quiz.build"),
        permissions=("knowledge.read",),
        safety_requirements=("Age-appropriate content", "Encourage independent reasoning"),
        model_configuration={"profile": "education", "temperature": 0.4},
        limits={"max_steps": 12},
    ),
    AgentSpec(
        id="coder",
        name="ASTA Coder",
        role="engineering",
        short="Builds, reviews and debugs code.",
        description="Code generation, review, debugging, tests and architecture guidance.",
        responsibilities=(
            "Code generation and explanation",
            "Debugging and refactoring",
            "Test generation",
            "Security review",
            "Documentation",
        ),
        allowed_tools=("code.static_analysis", "code.sandbox"),
        permissions=("code.analyze",),
        safety_requirements=("Untrusted code never executes on the host", "Sandbox required for execution"),
        model_configuration={"profile": "code", "temperature": 0.2},
        limits={"max_output_tokens": 4096},
    ),
    AgentSpec(
        id="analyst",
        name="ASTA Analyst",
        role="data",
        short="Turns data into evidence.",
        description="Local CSV/spreadsheet statistics, trends, validation and reporting.",
        responsibilities=(
            "Structured data validation",
            "Descriptive statistics",
            "Trend detection",
            "Assumption tracking",
        ),
        allowed_tools=("data.profile", "data.statistics"),
        permissions=("attachment.read",),
        safety_requirements=("Validate before concluding", "State assumptions explicitly"),
        model_configuration={"profile": "analysis", "temperature": 0.2},
        limits={"max_rows": 100000},
    ),
    AgentSpec(
        id="creator",
        name="ASTA Creator",
        role="creative",
        short="Shapes ideas into finished work.",
        description="Writing, storytelling, content planning and creative direction.",
        responsibilities=(
            "Drafting and storytelling",
            "Content planning",
            "Audience and tone definition",
            "Creative critique",
        ),
        allowed_tools=("content.outline",),
        permissions=("conversation.write",),
        safety_requirements=("Respect copyright", "No deceptive impersonation"),
        model_configuration={"profile": "creative", "temperature": 0.8},
        limits={"max_output_tokens": 4096},
    ),
    AgentSpec(
        id="voice",
        name="ASTA Voice",
        role="speech",
        short="Speaks and listens.",
        description="Browser speech recognition and synthesis, language-aware voice control.",
        responsibilities=("Speech input", "Speech output", "Voice configuration", "Transcripts"),
        allowed_tools=("speech.synthesize", "speech.transcribe"),
        permissions=("microphone.user_granted",),
        safety_requirements=("Microphone requires explicit permission", "No audio retained by default"),
        model_configuration={"profile": "speech", "note": "Runs in the browser; independent of chat provider"},
        limits={"timeout_seconds": 60},
    ),
    AgentSpec(
        id="operator",
        name="ASTA Operator",
        role="automation",
        short="Acts only with approval.",
        description="Permissioned actions, workflow execution and audited integrations.",
        responsibilities=("Permissioned tool use", "Workflow execution", "Action audit", "Integration status"),
        allowed_tools=("task.create", "note.save"),
        permissions=("tool.execute",),
        safety_requirements=("Explicit approval for consequential actions", "Full audit log", "No silent retries"),
        model_configuration={"profile": "planning", "temperature": 0.1},
        limits={"max_actions_per_task": 5},
    ),
    AgentSpec(
        id="memory",
        name="ASTA Memory",
        role="knowledge",
        short="Remembers only what you approve.",
        description="Approved personal memory and workspace knowledge, with full user control.",
        responsibilities=("Recall approved memories", "Propose new memories", "Enforce scope", "Audit access"),
        allowed_tools=("memory.recall", "memory.propose"),
        permissions=("memory.read", "memory.write"),
        safety_requirements=("Never auto-store sensitive data", "User can inspect and delete"),
        model_configuration={"profile": "retrieval", "note": "Deterministic, no generation"},
        limits={"max_items": 8},
    ),
    AgentSpec(
        id="guardian",
        name="ASTA Guardian",
        role="safety",
        short="Protects users and their data.",
        description="Input/output safety, permission verification, privacy and age safeguards.",
        responsibilities=(
            "Risk classification",
            "Prompt-injection neutralisation",
            "PII detection",
            "Permission verification",
            "Age-appropriate safeguards",
        ),
        allowed_tools=("policy.evaluate",),
        permissions=("safety.enforce",),
        safety_requirements=("Cannot be bypassed by other agents", "Decisions are auditable"),
        model_configuration={"profile": "classifier", "note": "Deterministic rules, not model-dependent"},
        limits={"timeout_seconds": 2},
    ),
    AgentSpec(
        id="planner",
        name="ASTA Planner",
        role="planning",
        short="Breaks goals into inspectable steps.",
        description="Dependency-aware planning, agent assignment and clarification requests.",
        responsibilities=("Goal decomposition", "Dependency mapping", "Agent assignment", "Blocked-state detection"),
        allowed_tools=("task.plan",),
        permissions=("task.plan",),
        safety_requirements=("Plans are inspectable", "Maximum step budget enforced"),
        model_configuration={"profile": "planning", "note": "Deterministic planner"},
        limits={"max_steps": 8},
    ),
    AgentSpec(
        id="monitor",
        name="ASTA Monitor",
        role="observability",
        short="Keeps the system honest.",
        description="Health, latency, failures and execution records without reading private content.",
        responsibilities=("Agent health", "Latency tracking", "Failure detection", "Diagnostic reporting"),
        allowed_tools=("system.metrics",),
        permissions=("system.read",),
        safety_requirements=("No conversation content in telemetry",),
        model_configuration={"profile": "none", "note": "No model"},
        limits={"retention_days": 30},
    ),
)

SPEC_BY_ID = {spec.id: spec for spec in AGENT_SPECS}


class AgentRegistry:
    def __init__(self) -> None:
        self._instances: dict[str, BaseAgent] = {}

    def register(self, agent: "BaseAgent") -> None:
        if agent.id not in SPEC_BY_ID:
            raise ValueError(f"Agent {agent.id} has no declared spec")
        self._instances[agent.id] = agent

    def get(self, agent_id: str) -> BaseAgent | None:
        return self._instances.get(agent_id)

    def require(self, agent_id: str) -> BaseAgent:
        agent = self.get(agent_id)
        if not agent:
            raise KeyError(f"Agent '{agent_id}' is not registered")
        return agent

    def ids(self) -> list[str]:
        return list(self._instances)

    def spec(self, agent_id: str) -> AgentSpec | None:
        return SPEC_BY_ID.get(agent_id)


registry = AgentRegistry()
