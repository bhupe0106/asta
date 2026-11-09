"""Agent registration. Importing this package wires every specialist."""
from app.agents.analyst import AnalystAgent
from app.agents.coder import CoderAgent
from app.agents.creator import CreatorAgent
from app.agents.guardian import GuardianAgent
from app.agents.memory import MemoryAgent
from app.agents.monitor import MonitorAgent
from app.agents.operator import OperatorAgent
from app.agents.planner import PlannerAgent
from app.agents.researcher import ResearcherAgent
from app.agents.scholar import ScholarAgent
from app.agents.voice import VoiceAgent
from app.orchestration.registry import registry

for _agent in (
    ResearcherAgent(),
    ScholarAgent(),
    CoderAgent(),
    AnalystAgent(),
    CreatorAgent(),
    VoiceAgent(),
    OperatorAgent(),
    MemoryAgent(),
    GuardianAgent(),
    PlannerAgent(),
    MonitorAgent(),
):
    registry.register(_agent)

__all__ = ["registry"]
