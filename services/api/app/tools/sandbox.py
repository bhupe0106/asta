"""Best-effort local Python execution.

This is deliberately *not* presented as a hardened security sandbox. It runs a
short-lived isolated-mode Python process in a temporary directory with a hard
timeout, stripped environment, capped output and no shell. On POSIX it also
applies CPU, memory and file-size rlimits where available.

A hardened deployment should replace this runner with a disposable container or
microVM. The API reports the isolation mode so callers can make that judgement.
"""
from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from app.core.config import settings

ISOLATION = "local subprocess (best-effort; not a hardened sandbox)"


class SandboxError(RuntimeError):
    pass


def _safe_env(home: Path) -> dict[str, str]:
    env = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": str(home),
        "TEMP": str(home),
        "TMP": str(home),
        "PYTHONIOENCODING": "utf-8",
        "PYTHONHASHSEED": "0",
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONNOUSERSITE": "1",
    }
    if sys.platform == "win32":
        for key in ("SYSTEMROOT", "WINDIR", "COMSPEC", "USERPROFILE"):
            if key in os.environ:
                env[key] = os.environ[key]
    return env


def _preexec() -> None:  # pragma: no cover - POSIX only
    try:
        import resource

        resource.setrlimit(resource.RLIMIT_CPU, (12, 12))
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_FSIZE, (5 * 1024 * 1024, 5 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_NPROC, (32, 32))
    except Exception:
        pass


async def run_python(code: str, *, timeout: float | None = None) -> dict:
    """Execute Python source and return a structured result.

    The caller must hold an authenticated session and the ``sandboxed_code``
    feature must be enabled by the deployment.
    """
    source = (code or "").strip()
    if not source:
        raise SandboxError("No code was supplied.")
    if len(source) > 20_000:
        raise SandboxError("Code exceeds the 20,000 character limit.")

    limit = min(float(timeout or settings.sandbox_timeout_seconds), 20.0)
    with tempfile.TemporaryDirectory(prefix="asta-sandbox-") as tmp:
        home = Path(tmp)
        script = home / "main.py"
        script.write_text(source, encoding="utf-8")
        kwargs: dict = {}
        if sys.platform == "win32":
            kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
        else:
            kwargs["preexec_fn"] = _preexec
        process = await asyncio.create_subprocess_exec(
            sys.executable,
            "-I",
            "-S",
            "-B",
            str(script),
            cwd=str(home),
            env=_safe_env(home),
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            **kwargs,
        )
        try:
            stdout_b, stderr_b = await asyncio.wait_for(process.communicate(), timeout=limit)
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            return {
                "status": "timeout",
                "exit_code": None,
                "stdout": "",
                "stderr": f"Execution exceeded {limit:.0f}s and was stopped.",
                "duration_ms": int(limit * 1000),
                "isolation": ISOLATION,
            }

    cap = settings.sandbox_max_output_chars
    stdout = stdout_b.decode("utf-8", errors="replace")[:cap]
    stderr = stderr_b.decode("utf-8", errors="replace")[:cap]
    return {
        "status": "ok" if process.returncode == 0 else "error",
        "exit_code": process.returncode,
        "stdout": stdout,
        "stderr": stderr,
        "isolation": ISOLATION,
    }
