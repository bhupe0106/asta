"""Capability discovery: what actually works on this deployment."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.router import model_router
from app.core.config import settings
from app.database.models import FeatureFlag, Integration, IntegrationConnection
from app.database.session import get_db
from app.schemas import CapabilitiesOut

router = APIRouter(tags=["capabilities"])

LANGUAGES = [
    {"code": "en", "name": "English", "rtl": False, "voice": True},
    {"code": "ta", "name": "Tamil", "rtl": False, "voice": True},
    {"code": "hi", "name": "Hindi", "rtl": False, "voice": True},
    {"code": "es", "name": "Spanish", "rtl": False, "voice": True},
    {"code": "fr", "name": "French", "rtl": False, "voice": True},
    {"code": "de", "name": "German", "rtl": False, "voice": True},
    {"code": "ar", "name": "Arabic", "rtl": True, "voice": True},
    {"code": "ja", "name": "Japanese", "rtl": False, "voice": True},
    {"code": "ko", "name": "Korean", "rtl": False, "voice": True},
    {"code": "zh", "name": "Chinese", "rtl": False, "voice": True},
    {"code": "pt", "name": "Portuguese", "rtl": False, "voice": True},
]


@router.get("/capabilities", response_model=CapabilitiesOut)
async def capabilities(db: Session = Depends(get_db)):
    flags = {flag.key: flag.enabled for flag in db.scalars(select(FeatureFlag)).all()}
    providers = await model_router.status()
    healthy = [p for p in providers if p["healthy"]]
    demo_available = any(p["key"] == "demo" and p["healthy"] for p in providers)
    webhook_available = db.scalar(select(Integration).where(Integration.key == "webhook")) is not None
    connected_integrations = db.scalar(
        select(IntegrationConnection).where(
            IntegrationConnection.integration_key == "webhook",
            IntegrationConnection.status == "connected",
        )
    )
    limitations: list[str] = []
    if not any(p["key"] == "ollama" and p["healthy"] for p in providers):
        limitations.append("No local Ollama model is reachable; responses use the labelled demo composer.")
    else:
        limitations.append("Local generation uses the configured Ollama model; speed depends on your hardware.")
    if settings.search_provider == "duckduckgo":
        limitations.append(
            "Web research uses DuckDuckGo's public HTML endpoint (Wikipedia fallback) and opens public pages; "
            "external content is untrusted and sources should be checked."
        )
    elif settings.search_provider == "searxng":
        limitations.append("Web research uses the configured SearXNG endpoint and public page retrieval.")
    elif settings.search_provider == "wikipedia":
        limitations.append("Web research is limited to Wikipedia's search API.")
    else:
        limitations.append("Web research is disabled on this deployment.")
    limitations.append(
        "Image and motion generation are original procedural SVG synthesis, not diffusion or generative video models."
    )
    limitations.append(
        "Code execution uses a best-effort local Python subprocess with a timeout and capped output; "
        "it is not a hardened security sandbox and should be replaced before exposing the API publicly."
    )
    limitations.append(
        "External actions are approval-gated webhook calls to endpoints you configure. OAuth-based integrations "
        "(email, calendar, cloud storage) remain unavailable until credentials are supplied."
    )
    limitations.append("Child accounts require guardian consent and independent safety review before release.")
    limitations.append("Interface translations are being rolled out; English is verified.")

    return CapabilitiesOut(
        version="0.2.0",
        environment=settings.environment,
        provider_mode=settings.provider_mode,
        features={
            "chat": True,
            "streaming": flags.get("streaming", True),
            "conversations": True,
            "agents": True,
            "tasks": True,
            "memory": True,
            "knowledge_upload": True,
            "knowledge_retrieval": "keyword",
            "voice_browser": flags.get("voice", True),
            "web_research": settings.search_provider != "disabled",
            "image_generation": flags.get("image_generation", True),
            "video_generation": flags.get("video_generation", True),
            "sandboxed_code": flags.get("sandboxed_code", False) and settings.sandbox_enabled,
            "external_actions": flags.get("external_actions", False) and webhook_available,
            "integrations": webhook_available or connected_integrations is not None,
            "model_connected": any(p["key"] != "demo" for p in healthy),
            "demo_composer": demo_available and settings.allow_demo_provider,
        },
        languages=[lang["code"] for lang in LANGUAGES],
        limitations=limitations,
    )


@router.get("/languages")
def languages():
    return {"languages": LANGUAGES}


@router.get("/voice/status")
def voice_status():
    return {
        "mode": "browser",
        "default_voice": "male",
        "microphone_permission": "requested_by_browser_at_use",
        "server_audio_storage": False,
        "synthesis": "window.speechSynthesis",
        "recognition": "window.SpeechRecognition || window.webkitSpeechRecognition",
        "note": (
            "Speech runs entirely in your browser. Available voices and languages depend on "
            "your operating system. ASTA never activates the microphone without a click."
        ),
    }
