"""Model router: provider selection, health caching and fallback."""
from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass

from app.ai.providers.base import (
    ChatMessage,
    GenerationResult,
    ModelProvider,
    ProviderError,
    ProviderHealth,
)
from app.ai.providers.demo import DemoProvider
from app.ai.providers.ollama import OllamaProvider
from app.core.config import settings


@dataclass
class RouteDecision:
    provider: ModelProvider
    reason: str
    is_fallback: bool = False


@dataclass
class ModelChunk:
    """A streamed piece of text plus the provider that actually produced it."""

    provider: str
    text: str
    fallback: bool = False


class ModelRouter:
    """Chooses a provider based on configuration, health and task needs.

    Health results are cached briefly so every chat turn does not block on a
    network probe.
    """

    def __init__(self) -> None:
        self._health: dict[str, tuple[float, ProviderHealth]] = {}
        self._health_ttl = 10.0
        self.ollama = OllamaProvider(
            settings.ollama_base_url, settings.ollama_model, settings.request_timeout_seconds
        )
        self.demo = DemoProvider()

    def providers(self) -> list[ModelProvider]:
        return [self.ollama, self.demo]

    def _configured_providers(self) -> list[ModelProvider]:
        if settings.provider_mode == "demo":
            return [self.demo]
        if settings.provider_mode == "ollama":
            return [self.ollama]
        providers: list[ModelProvider] = [self.ollama]
        if settings.allow_demo_provider:
            providers.append(self.demo)
        return providers

    async def health(self, provider: ModelProvider, *, use_cache: bool = True) -> ProviderHealth:
        now = time.monotonic()
        cached = self._health.get(provider.key)
        if use_cache and cached and now - cached[0] < self._health_ttl:
            return cached[1]
        health = await provider.health_check()
        self._health[provider.key] = (now, health)
        return health

    async def route(self, preferred: str | None = None) -> RouteDecision:
        candidates = self._configured_providers()
        if preferred:
            preferred_provider = next((p for p in candidates if p.key == preferred), None)
            if preferred_provider:
                health = await self.health(preferred_provider)
                if health.healthy:
                    return RouteDecision(preferred_provider, f"{preferred_provider.display_name} healthy")
        for index, provider in enumerate(candidates):
            health = await self.health(provider)
            if health.healthy:
                return RouteDecision(provider, health.detail, is_fallback=index > 0)
        return RouteDecision(
            candidates[-1],
            "No healthy provider found; the last configured provider will be attempted.",
            is_fallback=True,
        )

    async def generate(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        preferred: str | None = None,
        retries: int = 1,
    ) -> GenerationResult:
        decision = await self.route(preferred)
        last_error: Exception | None = None
        for attempt in range(retries + 1):
            try:
                return await decision.provider.generate(
                    messages, temperature=temperature, max_tokens=max_tokens
                )
            except ProviderError as exc:
                last_error = exc
                if not exc.retryable:
                    break
                await asyncio.sleep(0.4 * (attempt + 1))
        # Last-resort fallback only when demo mode is permitted.
        if settings.allow_demo_provider and decision.provider.key != "demo":
            return await self.demo.generate(messages, temperature=temperature, max_tokens=max_tokens)
        raise ProviderError(decision.provider.key, f"Generation failed: {last_error}")

    async def stream(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        preferred: str | None = None,
    ) -> AsyncIterator[ModelChunk]:
        decision = await self.route(preferred)
        provider = decision.provider
        produced = False
        try:
            async for chunk in provider.generate_stream(
                messages, temperature=temperature, max_tokens=max_tokens
            ):
                produced = True
                yield ModelChunk(provider.key, chunk, decision.is_fallback)
        except ProviderError:
            # Falling back after partial output would splice two voices into one
            # reply. Only fall back when nothing has been streamed yet.
            if settings.allow_demo_provider and provider.key != "demo" and not produced:
                async for chunk in self.demo.generate_stream(messages):
                    yield ModelChunk(self.demo.key, chunk, True)
            else:
                raise

    async def status(self) -> list[dict]:
        rows: list[dict] = []
        for provider in self.providers():
            health = await self.health(provider, use_cache=False)
            rows.append(
                {
                    "key": provider.key,
                    "display_name": provider.display_name,
                    "kind": provider.kind,
                    "configured": provider.is_configured(),
                    "healthy": health.healthy,
                    "model": health.model or (health.models[0] if health.models else None),
                    "detail": health.detail,
                }
            )
        return rows


model_router = ModelRouter()
