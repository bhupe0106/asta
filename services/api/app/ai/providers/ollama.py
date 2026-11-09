"""Ollama provider (local-first)."""
from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator

import httpx

from app.ai.providers.base import (
    ChatMessage,
    GenerationResult,
    ModelProvider,
    ProviderError,
    ProviderHealth,
    TokenUsage,
)


class OllamaProvider(ModelProvider):
    key = "ollama"
    display_name = "Ollama (local)"
    kind = "local"

    # Models that are embedding-only must never be selected for chat.
    EMBED_MARKERS = ("embed", "bge-", "minilm", "e5-", "nomic-embed")

    def __init__(self, base_url: str, default_model: str, timeout: float = 120.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model
        self.timeout = timeout

    def _is_text_model(self, name: str) -> bool:
        lowered = name.lower()
        return not any(marker in lowered for marker in self.EMBED_MARKERS)

    async def _resolve_model(self) -> str:
        """Resolve the configured name to an installed tag.

        Ollama treats ``llama3.2`` as ``llama3.2:latest``. If the operator
        configured a family name but installed a sized tag (``llama3.2:3b``),
        an exact request would fail. Resolving against the installed tags is
        still driven by server configuration — no model name is invented — and
        keeps the health report truthful.
        """
        models = await self.list_models()
        configured = self.default_model
        if configured in models:
            return configured
        latest = f"{configured}:latest"
        if latest in models:
            return latest
        prefix = f"{configured}:"
        matches = sorted(
            name for name in models if name.startswith(prefix) and self._is_text_model(name)
        )
        if matches:
            return matches[0]
        return configured

    def supports_tools(self) -> bool:
        return True

    def supports_embeddings(self) -> bool:
        return True

    async def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout)

    async def generate(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        model: str | None = None,
    ) -> GenerationResult:
        started = time.perf_counter()
        payload = {
            "model": model or await self._resolve_model(),
            "messages": [m.__dict__ for m in messages],
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        try:
            async with await self._client() as client:
                res = await client.post("/api/chat", json=payload)
                res.raise_for_status()
                data = res.json()
        except httpx.HTTPError as exc:
            raise ProviderError(self.key, f"Ollama request failed: {exc}") from exc

        text = (data.get("message") or {}).get("content", "")
        prompt_tokens = int(data.get("prompt_eval_count") or 0)
        out_tokens = int(data.get("eval_count") or 0)
        return GenerationResult(
            text=text,
            model=data.get("model", payload["model"]),
            provider=self.key,
            usage=TokenUsage(prompt_tokens, out_tokens),
            latency_ms=int((time.perf_counter() - started) * 1000),
        )

    async def generate_stream(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        model: str | None = None,
    ) -> AsyncIterator[str]:
        payload = {
            "model": model or await self._resolve_model(),
            "messages": [m.__dict__ for m in messages],
            "stream": True,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        try:
            async with await self._client() as client:
                async with client.stream("POST", "/api/chat", json=payload) as res:
                    res.raise_for_status()
                    async for line in res.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            chunk = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        piece = (chunk.get("message") or {}).get("content", "")
                        if piece:
                            yield piece
                        if chunk.get("done"):
                            break
        except httpx.HTTPError as exc:
            raise ProviderError(self.key, f"Ollama stream failed: {exc}") from exc

    async def list_models(self) -> list[str]:
        try:
            async with await self._client() as client:
                res = await client.get("/api/tags")
                res.raise_for_status()
                return sorted(m.get("name", "") for m in res.json().get("models", []))
        except httpx.HTTPError:
            return []

    async def health_check(self) -> ProviderHealth:
        try:
            async with await self._client() as client:
                res = await client.get("/api/tags", timeout=5.0)
                res.raise_for_status()
                models = sorted(m.get("name", "") for m in res.json().get("models", []) if m.get("name"))
        except httpx.HTTPError as exc:
            return ProviderHealth(False, f"Ollama is not reachable at {self.base_url}. {exc}", [])

        if not models:
            return ProviderHealth(False, "Ollama is reachable but has no models installed.", [])

        resolved = await self._resolve_model()
        if resolved not in models:
            listed = ", ".join(models[:6])
            return ProviderHealth(
                False,
                f"Configured model '{self.default_model}' is not installed. Pull it with "
                f"'ollama pull {self.default_model}' or update ASTA_OLLAMA_MODEL. Installed: {listed}.",
                models,
                None,
            )
        detail = f"Ollama reachable with {len(models)} model(s)."
        if resolved != self.default_model:
            detail += f" Resolved '{self.default_model}' to installed tag '{resolved}'."
        return ProviderHealth(True, detail, models, resolved)
