"""ASTA Analyst: real local statistics over attached tabular data."""
from __future__ import annotations

import csv
import io
import statistics
import time

from app.agents.base import AgentContext, AgentResult, BaseAgent

MAX_ROWS = 20_000


def _sniff(text: str) -> csv.Dialect:
    sample = text[:4096]
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        return csv.excel


def _to_float(value: str) -> float | None:
    try:
        cleaned = value.replace(",", "").strip()
        if cleaned == "":
            return None
        return float(cleaned)
    except ValueError:
        return None


def profile_csv(text: str) -> dict:
    dialect = _sniff(text)
    reader = csv.reader(io.StringIO(text), dialect)
    rows = list(reader)
    if not rows:
        return {"error": "The file is empty."}
    header = [h.strip() or f"column_{i+1}" for i, h in enumerate(rows[0])]
    body = [r for r in rows[1:] if any(cell.strip() for cell in r)]
    truncated = len(body) > MAX_ROWS
    body = body[:MAX_ROWS]

    columns: list[dict] = []
    for index, name in enumerate(header):
        values = [r[index].strip() if index < len(r) else "" for r in body]
        missing = sum(1 for v in values if v == "")
        numeric = [n for n in (_to_float(v) for v in values) if n is not None]
        entry: dict = {
            "name": name,
            "missing": missing,
            "non_empty": len(values) - missing,
            "kind": "numeric" if len(numeric) >= max(1, len(values) // 2) else "text",
        }
        if entry["kind"] == "numeric" and numeric:
            entry.update(
                {
                    "mean": round(statistics.fmean(numeric), 4),
                    "median": round(statistics.median(numeric), 4),
                    "min": round(min(numeric), 4),
                    "max": round(max(numeric), 4),
                    "stdev": round(statistics.pstdev(numeric), 4) if len(numeric) > 1 else 0.0,
                }
            )
        else:
            counts: dict[str, int] = {}
            for v in values:
                if v:
                    counts[v] = counts.get(v, 0) + 1
            entry["top"] = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:3]
        columns.append(entry)

    duplicates = len(body) - len({tuple(r) for r in body})
    return {
        "rows": len(body),
        "columns_count": len(header),
        "truncated": truncated,
        "duplicates": duplicates,
        "columns": columns,
    }


def render_report(profile: dict) -> str:
    if "error" in profile:
        return profile["error"]
    lines = [
        f"Rows analysed: {profile['rows']} (duplicate rows: {profile['duplicates']})",
        f"Columns: {profile['columns_count']}",
        "",
        "| Column | Type | Missing | Summary |",
        "|---|---|---|---|",
    ]
    for col in profile["columns"]:
        if col["kind"] == "numeric":
            summary = f"mean {col['mean']}, median {col['median']}, range {col['min']}–{col['max']}"
        else:
            top = ", ".join(f"{name} ({count})" for name, count in col.get("top", []))
            summary = top or "no values"
        lines.append(f"| {col['name']} | {col['kind']} | {col['missing']} | {summary} |")
    lines += [
        "",
        "Validation notes: empty cells are treated as missing; duplicate detection uses whole rows. "
        "Correlation is not causation and the sample may not represent a wider population.",
    ]
    if profile.get("truncated"):
        lines.append(f"Only the first {MAX_ROWS} rows were profiled.")
    return "\n".join(lines)


class AnalystAgent(BaseAgent):
    id = "analyst"
    name = "ASTA Analyst"
    role = "data"

    async def run(self, ctx: AgentContext) -> AgentResult:
        started = time.perf_counter()
        text = ctx.attachment_text
        if not text.strip():
            return AgentResult(
                agent_id=self.id,
                status="skipped",
                summary="No tabular attachment was provided, so no statistics were computed.",
                details="Attach a CSV or XLSX file to receive real descriptive statistics.",
                latency_ms=int((time.perf_counter() - started) * 1000),
            )
        try:
            profile = profile_csv(text)
        except Exception as exc:
            return AgentResult(
                agent_id=self.id,
                status="failed",
                summary="The attachment could not be parsed as tabular data.",
                details=str(exc),
                latency_ms=int((time.perf_counter() - started) * 1000),
            )
        report = render_report(profile)
        return AgentResult(
            agent_id=self.id,
            status="ok",
            summary=f"Profiled {profile.get('rows', 0)} rows across {profile.get('columns_count', 0)} columns locally.",
            details=report,
            data={"profile": profile},
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
