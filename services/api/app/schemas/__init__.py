"""Request/response schemas (Pydantic v2)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Auth / identity
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="Traveler", min_length=1, max_length=80)
    age_band: Literal["child", "teen", "adult"] = "adult"
    guardian_email: EmailStr | None = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if v.isdigit() or v.isalpha():
            raise ValueError("Password must mix letters and numbers.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: "UserOut"


class GuestRequest(BaseModel):
    display_name: str = Field(default="Guest Traveler", max_length=80)
    age_band: Literal["teen", "adult"] = "adult"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    display_name: str
    role: str
    age_band: str
    is_guest: bool
    created_at: datetime


class PreferencesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    app_language: str
    response_language: str
    voice_enabled: bool
    voice_name: str
    voice_pitch: float
    voice_rate: float
    reduced_motion: bool
    text_scale: str
    high_contrast: bool
    memory_enabled: bool
    store_history: bool


class PreferencesUpdate(BaseModel):
    app_language: str | None = Field(default=None, max_length=16)
    response_language: str | None = Field(default=None, max_length=16)
    voice_enabled: bool | None = None
    voice_name: str | None = Field(default=None, max_length=64)
    voice_pitch: float | None = Field(default=None, ge=0.5, le=2.0)
    voice_rate: float | None = Field(default=None, ge=0.5, le=2.0)
    reduced_motion: bool | None = None
    text_scale: Literal["90", "100", "112", "125"] | None = None
    high_contrast: bool | None = None
    memory_enabled: bool | None = None
    store_history: bool | None = None


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------
class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    experience: Literal["learn", "work", "create", "companion"] = "companion"
    language: str | None = Field(default=None, max_length=16)


class ConversationUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    pinned: bool | None = None
    archived: bool | None = None


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    experience: str
    language: str | None
    pinned: bool
    archived: bool
    created_at: datetime
    updated_at: datetime
    meta: dict = Field(default_factory=dict)


class Citation(BaseModel):
    title: str
    url: str | None = None
    snippet: str | None = None
    verified: bool = False


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: str
    content: str
    agent_id: str | None = None
    citations: list[Citation] = Field(default_factory=list)
    tool_runs: list[dict] = Field(default_factory=list)
    meta: dict = Field(default_factory=dict)
    created_at: datetime


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=20000)
    language: str | None = Field(default=None, max_length=16)
    attachment_ids: list[str] = Field(default_factory=list, max_length=5)


class FeedbackCreate(BaseModel):
    rating: Literal[-1, 1]
    comment: str | None = Field(default=None, max_length=2000)


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------
class AgentOut(BaseModel):
    id: str
    name: str
    role: str
    description: str
    responsibilities: list[str] = Field(default_factory=list)
    allowed_tools: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)
    status: str = "available"
    safety_requirements: list[str] = Field(default_factory=list)
    model_configuration: dict = Field(default_factory=dict)
    limits: dict = Field(default_factory=dict)


class AgentExecuteRequest(BaseModel):
    input: str = Field(min_length=1, max_length=8000)
    conversation_id: str | None = None


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------
class TaskCreate(BaseModel):
    goal: str = Field(min_length=3, max_length=4000)
    title: str | None = Field(default=None, max_length=200)
    conversation_id: str | None = None
    auto_execute: bool = False


class TaskStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    position: int
    title: str
    description: str
    agent_id: str
    status: str
    depends_on: list[str] = Field(default_factory=list)
    output: str | None = None
    error: str | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    goal: str
    status: str
    risk: str
    requires_approval: bool
    result: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    steps: list[TaskStepOut] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Memory
# ---------------------------------------------------------------------------
class MemoryCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    kind: Literal["fact", "preference", "goal", "context"] = "fact"
    scope: Literal["personal", "workspace"] = "personal"


class MemoryUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=4000)
    kind: Literal["fact", "preference", "goal", "context"] | None = None
    approved: bool | None = None


class MemoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    content: str
    kind: str
    scope: str
    approved: bool
    source: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Knowledge
# ---------------------------------------------------------------------------
class KnowledgeDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    mime_type: str
    size_bytes: int
    status: str
    error: str | None
    created_at: datetime


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=1000)
    limit: int = Field(default=5, ge=1, le=20)


class KnowledgeHit(BaseModel):
    document_id: str
    document_title: str
    chunk: str
    score: float


# ---------------------------------------------------------------------------
# Capabilities / models
# ---------------------------------------------------------------------------
class ProviderStatus(BaseModel):
    key: str
    display_name: str
    kind: str
    configured: bool
    healthy: bool
    model: str | None = None
    detail: str = ""


class CapabilitiesOut(BaseModel):
    product: str = "ASTA"
    version: str
    environment: str
    provider_mode: str
    features: dict[str, bool | str]
    languages: list[str]
    limitations: list[str]


TokenResponse.model_rebuild()
