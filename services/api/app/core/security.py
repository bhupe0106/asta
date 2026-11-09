"""Authentication primitives.

PBKDF2-HMAC-SHA256 with per-user salt (no external crypto dependency) and
HMAC-signed, expiring access tokens backed by a revocable server-side session.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
import uuid

from app.core.config import settings

PBKDF2_ITERATIONS = 390_000


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        _algo, iterations, salt_b64, digest_b64 = encoded.split("$")
        salt = _unb64(salt_b64)
        expected = _unb64(digest_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: str, session_id: str, token_id: str | None = None) -> tuple[str, int]:
    """Return (token, expires_at_epoch)."""
    expires_at = int(time.time()) + settings.access_token_minutes * 60
    payload = {
        "sub": user_id,
        "sid": session_id,
        "jti": token_id or uuid.uuid4().hex,
        "exp": expires_at,
        "iat": int(time.time()),
    }
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    signature = _b64(hmac.new(settings.secret_key.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{signature}", expires_at


def decode_access_token(token: str) -> dict | None:
    try:
        body, signature = token.split(".")
        expected = _b64(hmac.new(settings.secret_key.encode(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            return None
        payload = json.loads(_unb64(body))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except (ValueError, json.JSONDecodeError):
        return None


def constant_time_compare(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())
