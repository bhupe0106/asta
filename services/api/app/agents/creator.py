"""ASTA Creator: creative direction plus original procedural media."""
from __future__ import annotations

import re
import time

from app.agents.base import AgentContext, AgentResult, BaseAgent, ToolRun
from app.tools.art import generate_artifact

AUDIENCE_SIGNALS = {
    "children": ("child", "kid", "school", "young reader"),
    "professionals": ("executive", "b2b", "client", "stakeholder", "team lead"),
    "general public": ("everyone", "general", "public", "social media"),
    "students": ("student", "learner", "study", "class"),
}

TONE_SIGNALS = {
    "warm": ("warm", "friendly", "kind", "gentle"),
    "bold": ("bold", "punchy", "dramatic", "powerful"),
    "professional": ("professional", "formal", "corporate", "precise"),
    "playful": ("fun", "playful", "witty", "humorous"),
    "cinematic": ("cinematic", "epic", "atmospheric", "dark fantasy"),
}

IMAGE_PATTERN = re.compile(
    r"\b(image|picture|illustration|draw|logo|poster|artwork|sigil|emblem|cover art|wallpaper)\b", re.IGNORECASE
)
VIDEO_PATTERN = re.compile(r"\b(video|animation|animate|motion graphic|motion sigil|loop)\b", re.IGNORECASE)


def _infer(text: str, mapping: dict[str, tuple[str, ...]], default: str) -> str:
    lowered = text.lower()
    for label, words in mapping.items():
        if any(w in lowered for w in words):
            return label
    return default


class CreatorAgent(BaseAgent):
    id = "creator"
    name = "ASTA Creator"
    role = "creative"

    async def run(self, ctx: AgentContext) -> AgentResult:
        started = time.perf_counter()
        wants_video = bool(VIDEO_PATTERN.search(ctx.text))
        wants_image = wants_video or bool(IMAGE_PATTERN.search(ctx.text))

        if wants_image:
            kind = "video" if wants_video else "image"
            artifact = generate_artifact(ctx.text, kind)
            label = "motion sigil" if kind == "video" else "sigil artwork"
            return AgentResult(
                agent_id=self.id,
                status="ok",
                summary=f"Generated an original procedural {label}.",
                details=(
                    f"Created {artifact.filename} locally from a deterministic vector synthesis pass.\n"
                    f"Mode: {artifact.mode}. No diffusion model, stock library or third-party image service was used.\n"
                    f"URL: {artifact.url}"
                ),
                tool_runs=[ToolRun("media.procedural", "ok", artifact.mode)],
                data={
                    "artifact": {
                        "url": artifact.url,
                        "kind": artifact.kind,
                        "mode": artifact.mode,
                        "alt": f"Procedural ASTA {label}",
                    }
                },
                latency_ms=int((time.perf_counter() - started) * 1000),
            )

        audience = _infer(ctx.text, AUDIENCE_SIGNALS, "general public")
        tone = _infer(ctx.text, TONE_SIGNALS, "cinematic")
        word_target = "short-form (under 150 words)"
        match = re.search(r"(\d{2,4})\s*words", ctx.text.lower())
        if match:
            word_target = f"approximately {match.group(1)} words"

        brief = (
            f"Audience: {audience}\nTone: {tone}\nLength: {word_target}\n"
            "Structure: hook → single core idea → concrete detail → call to action.\n"
            "Craft notes: one metaphor per idea, no filler adjectives, read aloud before delivery.\n"
            "Rights: original phrasing only; no copyrighted character names, lyrics or artwork."
        )
        return AgentResult(
            agent_id=self.id,
            status="ok",
            summary=f"Prepared a {tone} creative brief for {audience}.",
            details=brief,
            data={"audience": audience, "tone": tone, "word_target": word_target},
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
