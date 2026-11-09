"""v1 router aggregation."""
from fastapi import APIRouter

from app.api.v1 import (
    agents,
    attachments,
    auth,
    capabilities,
    conversations,
    integrations,
    knowledge,
    media,
    memory,
    models,
    preferences,
    tasks,
    tools,
)

api_router = APIRouter()
for module in (
    auth,
    conversations,
    agents,
    tasks,
    memory,
    knowledge,
    attachments,
    preferences,
    integrations,
    media,
    tools,
    capabilities,
    models,
):
    api_router.include_router(module.router)
