"""Test configuration.

The settings object is created when ``app.core.config`` is imported, so the
environment must be prepared before the application is imported.
"""
from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

TEST_ROOT = Path(tempfile.mkdtemp(prefix="asta-tests-"))
os.environ["ASTA_ENVIRONMENT"] = "test"
os.environ["ASTA_DATABASE_URL"] = f"sqlite:///{(TEST_ROOT / 'asta-test.db').as_posix()}"
os.environ["ASTA_UPLOAD_DIR"] = str(TEST_ROOT / "uploads")
os.environ["ASTA_PROVIDER_MODE"] = "demo"
os.environ["ASTA_ALLOW_DEMO_PROVIDER"] = "true"
os.environ["ASTA_ENABLE_REGISTRATION"] = "true"
os.environ["ASTA_SECRET_KEY"] = "test-only-secret"
os.environ["ASTA_SEARCH_PROVIDER"] = "disabled"

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def auth(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/guest",
        json={"display_name": "Test Traveler", "age_band": "adult"},
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session", autouse=True)
def cleanup():
    yield
    shutil.rmtree(TEST_ROOT, ignore_errors=True)
