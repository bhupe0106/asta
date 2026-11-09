"""Provider-independent model interface.

Every provider implements the same contract so the orchestration layer never
depends on a specific vendor. Capabilities are reported, never assumed.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ChatMessage:
    role: str
    content: str


@dataclass
class TokenUsage:
    input: int = 0
    output: int = 0


@dataclass
class GenerationResult:
    text: str
    model: str
    provider: str
    usage: TokenUsage = field(default_factory=TokenUsage)
    latency_ms: int = 0
    finish_reason: str = "stop"
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderHealth:
    healthy: bool
    detail: str
    models: list[str] = field(default_factory=list)
    model: str | None = None


class ModelProvider(ABC):
    key: str = "base"
    display_name: str = "Base provider"
    kind: str = "local"
    requires_api_key: bool = False

    @abstractmethod
    async def generate(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        model: str | None = None,
    ) -> GenerationResult: ...

    @abstractmethod
    def generate_stream(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        model: str | None = None,
    ) -> AsyncIterator[str]: ...

    @abstractmethod
    async def list_models(self) -> list[str]: ...

    @abstractmethod
    async def health_check(self) -> ProviderHealth: ...

    def supports_tools(self) -> bool:
        return False

    def supports_vision(self) -> bool:
        return False

    def supports_embeddings(self) -> bool:
        return False

    def is_configured(self) -> bool:
        return True


class ProviderError(RuntimeError):
    """Raised when a provider is unreachable or rejects a request."""

    def __init__(self, provider: str, message: str, retryable: bool = True) -> None:
        super().__init__(message)
        self.provider = provider
        self.retryable = retryable
