"""End-to-end API tests for the ASTA backend (demo provider)."""
from __future__ import annotations

import json
import uuid

from fastapi.testclient import TestClient

API = "/api/v1"


def parse_sse(body: str) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    for block in body.replace("\r\n", "\n").split("\n\n"):
        if not block.strip():
            continue
        name = "message"
        data_lines: list[str] = []
        for line in block.splitlines():
            if line.startswith("event:"):
                name = line[6:].strip()
            elif line.startswith("data:"):
                data_lines.append(line[5:].strip())
        if data_lines:
            events.append((name, json.loads("\n".join(data_lines))))
    return events


def test_health(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_guest_identity_and_me(client: TestClient, auth: dict[str, str]):
    response = client.get(f"{API}/users/me", headers=auth)
    assert response.status_code == 200
    body = response.json()
    assert body["is_guest"] is True
    assert body["display_name"] == "Test Traveler"


def test_registration_validation_and_login(client: TestClient):
    email = f"traveler-{uuid.uuid4().hex[:8]}@example.com"
    weak = client.post(
        f"{API}/auth/register",
        json={"email": email, "password": "onlyletters", "display_name": "Weak", "age_band": "adult"},
    )
    assert weak.status_code == 422

    child_without_guardian = client.post(
        f"{API}/auth/register",
        json={"email": email, "password": "strong123", "display_name": "Child", "age_band": "child"},
    )
    assert child_without_guardian.status_code == 400

    created = client.post(
        f"{API}/auth/register",
        json={
            "email": email,
            "password": "strong123",
            "display_name": "Registered Traveler",
            "age_band": "adult",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["user"]["is_guest"] is False

    login = client.post(f"{API}/auth/login", json={"email": email, "password": "strong123"})
    assert login.status_code == 200
    assert login.json()["user"]["email"] == email

    wrong = client.post(f"{API}/auth/login", json={"email": email, "password": "nope1234"})
    assert wrong.status_code == 401


def test_agent_registry_has_twelve_roles(client: TestClient, auth: dict[str, str]):
    response = client.get(f"{API}/agents", headers=auth)
    assert response.status_code == 200
    agents = response.json()
    ids = {agent["id"] for agent in agents}
    assert len(agents) == 12
    assert {"brain", "guardian", "researcher", "scholar", "coder", "analyst", "creator", "voice", "operator", "memory", "planner", "monitor"} <= ids
    assert all(agent["status"] in {"available", "degraded", "unavailable"} for agent in agents)


def test_capabilities_and_models_are_honest(client: TestClient):
    capabilities = client.get(f"{API}/capabilities")
    assert capabilities.status_code == 200
    features = capabilities.json()["features"]
    assert features["chat"] is True
    assert features["image_generation"] is True
    assert features["video_generation"] is True
    assert features["sandboxed_code"] is True
    assert features["external_actions"] is True
    assert features["integrations"] is True
    assert features["web_research"] is False  # disabled explicitly in the test environment
    assert capabilities.json()["limitations"]

    models = client.get(f"{API}/models")
    assert models.status_code == 200
    body = models.json()
    assert body["mode"] == "demo"
    assert body["providers"], "at least the demo provider must be reported"
    provider_keys = {provider["key"] for provider in body["providers"]}
    assert "demo" in provider_keys


def test_conversation_streaming_and_persistence(client: TestClient, auth: dict[str, str]):
    created = client.post(
        f"{API}/conversations",
        json={"experience": "learn", "title": "Photosynthesis"},
        headers=auth,
    )
    assert created.status_code == 201
    conversation_id = created.json()["id"]

    with client.stream(
        "POST",
        f"{API}/conversations/{conversation_id}/messages/stream",
        json={"content": "Explain photosynthesis step by step for a 12-year-old."},
        headers=auth,
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        body = "".join(response.iter_text())

    events = parse_sse(body)
    names = [name for name, _ in events]
    assert "start" in names
    assert "delta" in names
    assert names[-1] == "done"

    done = next(data for name, data in reversed(events) if name == "done")
    assert done["meta"]["demo_mode"] is True
    assert done["meta"]["intent"]
    streamed = "".join(str(data.get("text", "")) for name, data in events if name == "delta")
    assert len(streamed) > 100

    messages = client.get(f"{API}/conversations/{conversation_id}/messages", headers=auth)
    assert messages.status_code == 200
    rows = messages.json()
    assert [row["role"] for row in rows] == ["user", "assistant"]
    assert rows[0]["content"].startswith("Explain photosynthesis")
    assert len(rows[1]["content"]) > 100
    assert rows[1]["meta"]["demo_mode"] is True


def test_knowledge_upload_search_and_delete(client: TestClient, auth: dict[str, str]):
    content = (
        "Battery recycling policy. Lithium batteries must be separated from household waste. "
        "Collection points accept damaged cells with terminal tape applied."
    ).encode()
    upload = client.post(
        f"{API}/knowledge/documents",
        files={"file": ("battery-policy.txt", content, "text/plain")},
        headers=auth,
    )
    assert upload.status_code == 201, upload.text
    document = upload.json()
    assert document["status"] == "indexed"

    listing = client.get(f"{API}/knowledge", headers=auth)
    assert listing.status_code == 200
    assert listing.json()["document_count"] >= 1

    search = client.post(f"{API}/knowledge/search", json={"query": "lithium battery collection", "limit": 5}, headers=auth)
    assert search.status_code == 200
    hits = search.json()
    assert hits
    assert any(hit["document_id"] == document["id"] for hit in hits)

    delete = client.delete(f"{API}/knowledge/{document['id']}", headers=auth)
    assert delete.status_code == 204


def test_memory_approval_and_export(client: TestClient, auth: dict[str, str]):
    created = client.post(
        f"{API}/memory",
        json={"content": "I prefer concise answers with a summary first.", "kind": "preference"},
        headers=auth,
    )
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["approved"] is True

    unapproved = client.patch(f"{API}/memory/{item['id']}", json={"approved": False}, headers=auth)
    assert unapproved.status_code == 200
    assert unapproved.json()["approved"] is False

    approved = client.patch(f"{API}/memory/{item['id']}", json={"approved": True}, headers=auth)
    assert approved.status_code == 200
    assert approved.json()["approved"] is True

    export = client.get(f"{API}/memory/export", headers=auth)
    assert export.status_code == 200
    assert export.json()["count"] >= 1

    deleted = client.delete(f"{API}/memory/{item['id']}", headers=auth)
    assert deleted.status_code == 204


def test_task_planning_is_inspectable(client: TestClient, auth: dict[str, str]):
    created = client.post(
        f"{API}/tasks",
        json={"goal": "Prepare a short research brief on battery recycling", "auto_execute": False},
        headers=auth,
    )
    assert created.status_code == 201, created.text
    task = created.json()
    assert task["status"] in {"planned", "waiting_approval", "queued", "draft"}
    assert len(task["steps"]) >= 1
    assert all(step["agent_id"] for step in task["steps"])

    listing = client.get(f"{API}/tasks", headers=auth)
    assert listing.status_code == 200
    assert any(row["id"] == task["id"] for row in listing.json())

    logs = client.get(f"{API}/tasks/{task['id']}/logs", headers=auth)
    assert logs.status_code == 200

    cancelled = client.post(f"{API}/tasks/{task['id']}/cancel", headers=auth)
    assert cancelled.status_code == 200


def test_preferences_update(client: TestClient, auth: dict[str, str]):
    response = client.patch(
        f"{API}/preferences",
        json={"reduced_motion": True, "text_scale": "112", "response_language": "ta"},
        headers=auth,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["reduced_motion"] is True
    assert body["text_scale"] == "112"
    assert body["response_language"] == "ta"


def test_integrations_are_not_faked(client: TestClient, auth: dict[str, str]):
    listing = client.get(f"{API}/integrations", headers=auth)
    assert listing.status_code == 200
    body = listing.json()
    assert body["external_actions_enabled"] is True
    assert body["integrations"]
    by_key = {item["key"]: item for item in body["integrations"]}
    assert by_key["webhook"]["status"] == "available"
    assert all(
        item["status"] == "not_configured"
        for key, item in by_key.items()
        if key != "webhook"
    )

    attempt = client.post(f"{API}/integrations/email/connect", headers=auth, json={})
    assert attempt.status_code == 501
    assert "not configured" in attempt.json()["detail"].lower()

    queued = client.post(f"{API}/integrations/webhook/test", headers=auth)
    assert queued.status_code == 409  # no webhook connected yet

    connected = client.post(
        f"{API}/integrations/webhook/connect",
        headers=auth,
        json={"url": "https://example.com/asta-hook", "token": "test-secret"},
    )
    assert connected.status_code == 200
    connection_id = connected.json()["connection"]["id"]

    listing = client.get(f"{API}/integrations", headers=auth)
    by_key = {item["key"]: item for item in listing.json()["integrations"]}
    assert by_key["webhook"]["connection"]["status"] == "connected"
    # Secrets are never returned to the browser.
    assert "test-secret" not in listing.text

    revoked = client.delete(f"{API}/integrations/{connection_id}", headers=auth)
    assert revoked.status_code == 200
    listing = client.get(f"{API}/integrations", headers=auth)
    by_key = {item["key"]: item for item in listing.json()["integrations"]}
    assert by_key["webhook"]["connection"] is None
    assert by_key["webhook"]["status"] == "available"


def test_procedural_media_generation(client: TestClient, auth: dict[str, str]):
    generated = client.post(
        f"{API}/media/generate",
        json={"prompt": "a five-leaf grimoire sigil in crimson and gold", "kind": "image"},
        headers=auth,
    )
    assert generated.status_code == 201, generated.text
    body = generated.json()
    assert body["mode"] == "procedural-svg"
    path = body["url"].removeprefix("/api/v1")
    served = client.get(f"{API}{path}")
    assert served.status_code == 200
    assert served.headers["content-type"].startswith("image/svg+xml")
    assert "<svg" in served.text


def test_code_execution_endpoint(client: TestClient, auth: dict[str, str]):
    tools = client.get(f"{API}/tools", headers=auth)
    assert tools.status_code == 200
    assert any(item["key"] == "code.sandbox" and item["available"] for item in tools.json()["tools"])

    run = client.post(
        f"{API}/tools/code/run",
        json={"code": "print('asta-ok')", "timeout_seconds": 10},
        headers=auth,
    )
    assert run.status_code == 200, run.text
    body = run.json()
    assert body["status"] == "ok"
    assert "asta-ok" in body["stdout"]
    assert "best-effort" in body["isolation"]


def test_sandbox_kill_switch(client: TestClient, auth: dict[str, str], monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "sandbox_enabled", False)
    tools = client.get(f"{API}/tools", headers=auth).json()["tools"]
    entry = next(item for item in tools if item["key"] == "code.sandbox")
    assert entry["available"] is False

    run = client.post(
        f"{API}/tools/code/run",
        json={"code": "print('must-not-run')"},
        headers=auth,
    )
    assert run.status_code == 503
