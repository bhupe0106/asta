"""Model provider status."""
from __future__ import annotations

from fastapi import APIRouter

from app.ai.router import model_router
from app.core.config import settings

router = APIRouter(tags=["models"])


@router.get("/models")
async def models():
    providers = await model_router.status()
    return {
        "providers": providers,
        "mode": settings.provider_mode,
        "demo_fallback_enabled": settings.allow_demo_provider,
        "configured_model": settings.ollama_model,
        "note": (
            "Model names come from server configuration (ASTA_OLLAMA_MODEL), never from the browser. "
            "API keys, if added for cloud providers, stay server-side."
        ),
    }


@router.get("/models/status")
async def models_status():
    providers = await model_router.status()
    return {
        "healthy": [p for p in providers if p["healthy"]],
        "unhealthy": [p for p in providers if not p["healthy"]],
        "any_real_model": any(p["healthy"] and p["key"] != "demo" for p in providers),
    }
