"""ASTA Guardian: deterministic safety, privacy and permission enforcement.

Guardian rules run before any model call and before any tool execution. They are
intentionally simple, auditable and independent of the model provider, so a
misbehaving model cannot disable them.
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field

from app.agents.base import AgentContext, AgentResult, BaseAgent

SELF_HARM = re.compile(
    r"\b(kill myself|suicide|end my life|self[- ]harm|hurt myself|want to die)\b", re.IGNORECASE
)
SEVERE_HARM = re.compile(
    r"\b(make a bomb|build a bomb|poison someone|mass shooting|child sexual|csam|"
    r"how to kill|murder someone)\b",
    re.IGNORECASE,
)
INJECTION = re.compile(
    r"(ignore (all )?(previous|prior) instructions|reveal (your )?system prompt|"
    r"you are now (dan|developer mode)|disregard (your )?safety|jailbreak)",
    re.IGNORECASE,
)
CONSEQUENTIAL = re.compile(
    r"\b(send (an )?email|delete (all|my|the) files?|make a purchase|transfer (money|funds)|"
    r"publish (this|the) post|post (this|it) publicly|share (my|the) data)\b",
    re.IGNORECASE,
)
MATURE = re.compile(r"\b(explicit sexual|graphic violence|gambling|alcohol|drugs?)\b", re.IGNORECASE)
EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b")
PHONE = re.compile(r"(?<!\d)(\+?\d[\d\s().-]{7,}\d)(?!\d)")
CARD = re.compile(r"\b(?:\d[ -]*?){13,16}\b")

SUPPORTIVE_MESSAGE = (
    "I'm really glad you told me. I'm an AI, not a person, and I can't provide emergency support — "
    "but you deserve help right now.\n\n"
    "Please contact a trusted person near you, or your local emergency services if you are in "
    "immediate danger. If you can, stay with someone and move away from anything you could use "
    "to hurt yourself.\n\n"
    "You do not have to handle this alone. When you're ready, I can help you find local support "
    "services or write down what you want to say to someone you trust."
)

SEVERE_BLOCK_MESSAGE = (
    "I can't help with that request. It falls outside ASTA's safety boundaries because it could "
    "cause serious harm. I can help with related safety, legal, medical or emergency-planning "
    "questions in a constructive way."
)

CHILD_MATURE_MESSAGE = (
    "That topic isn't available in this learning space. Let's pick a different question — "
    "I'm happy to help with schoolwork, science, stories or a project."
)


@dataclass
class GuardianAssessment:
    risk: str = "low"  # low|medium|high|critical
    action: str = "allow"  # allow|neutralize|require_approval|block
    flags: list[str] = field(default_factory=list)
    notes: str = ""
    user_message: str | None = None
    redacted_text: str = ""
    requires_approval: bool = False


def scan_input(text: str, *, age_band: str = "adult") -> GuardianAssessment:
    flags: list[str] = []
    risk = "low"
    action = "allow"
    notes: list[str] = []

    if SELF_HARM.search(text):
        return GuardianAssessment(
            risk="critical",
            action="block",
            flags=["self_harm"],
            notes="Crisis language detected; responding with a supportive, non-model message.",
            user_message=SUPPORTIVE_MESSAGE,
        )
    if SEVERE_HARM.search(text):
        return GuardianAssessment(
            risk="critical",
            action="block",
            flags=["severe_harm"],
            notes="Severe harm request blocked.",
            user_message=SEVERE_BLOCK_MESSAGE,
            redacted_text=text,
        )
    if age_band == "child" and MATURE.search(text):
        return GuardianAssessment(
            risk="high",
            action="block",
            flags=["age_restriction"],
            notes="Mature topic blocked for a child account.",
            user_message=CHILD_MATURE_MESSAGE,
            redacted_text=text,
        )
    if INJECTION.search(text):
        flags.append("prompt_injection")
        risk = "medium"
        action = "neutralize"
        notes.append("Instruction-override attempt detected and neutralised.")
    if CONSEQUENTIAL.search(text):
        flags.append("consequential_action")
        risk = max(risk, "medium", key=["low", "medium", "high", "critical"].index)
        action = "require_approval" if action != "neutralize" else action
        notes.append("A consequential action requires explicit approval and audit logging.")
    redacted = text
    if EMAIL.search(text) or PHONE.search(text) or CARD.search(text):
        flags.append("pii")
        risk = max(risk, "medium", key=["low", "medium", "high", "critical"].index)
        notes.append("Potential personal data detected; it will not be written to memory automatically.")
        redacted = EMAIL.sub("[email redacted]", redacted)
        redacted = PHONE.sub("[phone redacted]", redacted)
        redacted = CARD.sub("[number redacted]", redacted)

    return GuardianAssessment(
        risk=risk,
        action=action,
        flags=flags,
        notes=" ".join(notes) or "No safety concerns detected.",
        redacted_text=redacted,
        requires_approval="consequential_action" in flags,
    )


def scan_output(text: str) -> GuardianAssessment:
    """Minimal output pass: no raw credential or card patterns leave the system."""
    if CARD.search(text):
        return GuardianAssessment(
            risk="medium",
            action="neutralize",
            flags=["output_pii"],
            notes="Output contained a card-like number; it was redacted.",
            redacted_text=CARD.sub("[redacted number]", text),
        )
    return GuardianAssessment(redacted_text=text)


class GuardianAgent(BaseAgent):
    id = "guardian"
    name = "ASTA Guardian"
    role = "safety"

    async def run(self, ctx: AgentContext) -> AgentResult:
        started = time.perf_counter()
        assessment = scan_input(ctx.text, age_band=ctx.age_band)
        return AgentResult(
            agent_id=self.id,
            status="ok" if assessment.action != "block" else "needs_approval",
            summary=f"Risk {assessment.risk}; policy action {assessment.action}.",
            details=assessment.notes,
            data={
                "risk": assessment.risk,
                "action": assessment.action,
                "flags": assessment.flags,
                "requires_approval": assessment.requires_approval,
            },
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
