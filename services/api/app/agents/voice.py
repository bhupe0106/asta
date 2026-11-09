"""ASTA Voice: capability reporting.

Audio is captured and synthesised in the browser (Web Speech API) so raw audio
never reaches the server unless the user explicitly opts into a future
transcription feature. This agent reports what is genuinely available.
"""
from __future__ import annotations

import time

from app.agents.base import AgentContext, AgentResult, BaseAgent

SUPPORTED = {
    "en": "English",
    "ta": "Tamil",
    "hi": "Hindi",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "ar": "Arabic",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
    "pt": "Portuguese",
}


class VoiceAgent(BaseAgent):
    id = "voice"
    name = "ASTA Voice"
    role = "speech"

    async def run(self, ctx: AgentContext) -> AgentResult:
        started = time.perf_counter()
        language = SUPPORTED.get(ctx.language, "English")
        return AgentResult(
            agent_id=self.id,
            status="ok",
            summary=f"Voice pipeline ready for {language}; speech runs locally in your browser.",
            details=(
                "Speech recognition and synthesis use the browser's installed voices. "
                "The microphone is only activated after you press the microphone button. "
                "No raw audio is stored on the server. Available voices depend on your "
                "operating system and browser."
            ),
            data={"language": ctx.language, "default_voice": "male", "server_audio_storage": False},
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
