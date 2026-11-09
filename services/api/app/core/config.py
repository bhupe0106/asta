"""Application configuration.

All settings can be overridden with ASTA_* environment variables or a .env file.
Never hardcode credentials here.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

def _resolve_base_dir() -> Path:
    """Find the project root in both the repo and the container image.

    Locally the file lives at ``<repo>/services/api/app/core/config.py``. In the
    Docker image it lives at ``/app/app/core/config.py``, where walking four
    parents up would fail, so fall back to the image workdir (``/app``).
    """
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "services" / "api").is_dir():
            return parent
    return here.parents[2] if len(here.parents) > 2 else here.parent


BASE_DIR = _resolve_base_dir()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", BASE_DIR / "services" / "api" / ".env"),
        env_prefix="ASTA_",
        extra="ignore",
    )

    app_name: str = "ASTA"
    environment: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api/v1"
    secret_key: str = "asta-dev-only-secret-change-me-in-production"
    access_token_minutes: int = 60 * 24 * 7

    database_url: str = f"sqlite:///{(BASE_DIR / 'data' / 'asta.db').as_posix()}"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Provider routing. "auto" prefers Ollama, then falls back to the clearly
    # labelled local demo composer when allowed. "ollama" never falls back.
    provider_mode: Literal["auto", "ollama", "demo"] = "auto"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.2"
    ollama_embed_model: str = "nomic-embed-text"
    request_timeout_seconds: float = 120.0

    # The demo composer is a deterministic, non-LLM scaffold generator used for
    # local development when no model is reachable. It is always labelled in the
    # UI and in API responses; it never pretends to be a language model.
    allow_demo_provider: bool = True

    upload_dir: str = "./data/uploads"
    max_upload_mb: int = 20

    search_provider: Literal["disabled", "searxng", "duckduckgo", "wikipedia"] = "duckduckgo"
    searxng_url: str = ""
    web_fetch_timeout_seconds: float = 15.0

    # Best-effort local code execution. Not a hardened sandbox; see
    # app/tools/sandbox.py for the isolation boundary and limitations.
    # Set ASTA_SANDBOX_ENABLED=false on any public deployment.
    sandbox_enabled: bool = True
    sandbox_timeout_seconds: float = 10.0
    sandbox_max_output_chars: int = 8000

    # Generated procedural media lives on local disk.
    media_dir: str = "./data/media"

    expiry_cleanup_hours: int = 24
    enable_registration: bool = True

    @property
    def base_path(self) -> Path:
        return BASE_DIR

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def upload_path(self) -> Path:
        p = Path(self.upload_dir)
        if not p.is_absolute():
            p = BASE_DIR / p
        p.mkdir(parents=True, exist_ok=True)
        return p


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
