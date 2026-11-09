"""Idempotent seed data (safe to run on every startup)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import AgentRecord, FeatureFlag, Integration, Role
from app.orchestration.registry import AGENT_SPECS

INTEGRATIONS = [
    ("webhook", "Custom webhook", "automation", "Send approved JSON payloads to an HTTPS endpoint you control."),
    ("email", "Email", "communication", "Send and read email with explicit approval per action."),
    ("calendar", "Calendar", "productivity", "Read availability and create events after approval."),
    ("cloud_storage", "Cloud storage", "storage", "Retrieve documents from an approved drive."),
    ("project_management", "Project management", "productivity", "Sync tasks and project boards."),
    ("developer_platform", "Developer platform", "engineering", "Repositories, issues and pull requests."),
    ("web_automation", "Browser automation", "automation", "Run approved browser workflows in isolation."),
]

FEATURES = [
    ("child_accounts", False, "Child accounts require verified parental consent and independent safety review."),
    ("web_research", True, "Live web search via DuckDuckGo HTML (Wikipedia fallback) or a configured SearXNG endpoint."),
    ("vector_search", False, "Deferred until document volume justifies vector infrastructure."),
    ("sandboxed_code", True, "Best-effort local Python execution; replace with a hardened sandbox in production."),
    ("external_actions", True, "Approval-gated webhook actions with an audit record."),
    ("image_generation", True, "Original procedural SVG generation; not a diffusion model."),
    ("video_generation", True, "Original procedural animated SVG; not a generative video model."),
    ("voice", True, "Browser speech synthesis and recognition; availability depends on the browser."),
    ("streaming", True, "Server-Sent Events streaming for chat."),
]


def seed(db: Session) -> None:
    for spec in AGENT_SPECS:
        record = db.get(AgentRecord, spec.id)
        if record is None:
            record = AgentRecord(
                id=spec.id,
                name=spec.name,
                role=spec.role,
                description=spec.description,
                allowed_tools=list(spec.allowed_tools),
                permissions=list(spec.permissions),
            )
            db.add(record)
        else:
            record.name = spec.name
            record.description = spec.description
            record.allowed_tools = list(spec.allowed_tools)
            record.permissions = list(spec.permissions)

    for key, display_name, category, description in INTEGRATIONS:
        if not db.scalar(select(Integration).where(Integration.key == key)):
            db.add(
                Integration(
                    key=key,
                    display_name=display_name,
                    category=category,
                    description=description,
                    status="not_configured",
                    requires_approval=True,
                )
            )

    for key, enabled, description in FEATURES:
        flag = db.get(FeatureFlag, key)
        if flag is None:
            db.add(FeatureFlag(key=key, enabled=enabled, description=description))
        else:
            flag.description = description
            flag.enabled = enabled

    for role_name in ("admin", "member", "educator", "guardian"):
        if not db.scalar(select(Role).where(Role.name == role_name)):
            db.add(Role(name=role_name, description=f"Default {role_name} role"))
    db.commit()
