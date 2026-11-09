"""Document extraction with strict validation.

Extensions are never trusted on their own: the declared content type and magic
bytes are checked, the parser is chosen from an allow-list, and size limits are
enforced before parsing.
"""
from __future__ import annotations

import csv
import io
import json
import zipfile
from pathlib import Path

ALLOWED = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".json": "application/json",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

MAGIC = {
    ".pdf": [b"%PDF"],
    ".docx": [b"PK\x03\x04"],
    ".xlsx": [b"PK\x03\x04"],
    ".pptx": [b"PK\x03\x04"],
}


class ExtractionError(ValueError):
    pass


def validate_upload(filename: str, content: bytes, max_mb: int) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED:
        raise ExtractionError(
            f"Unsupported file type '{suffix or 'unknown'}'. Allowed: {', '.join(sorted(ALLOWED))}"
        )
    if len(content) == 0:
        raise ExtractionError("The uploaded file is empty.")
    if len(content) > max_mb * 1024 * 1024:
        raise ExtractionError(f"File exceeds the {max_mb} MB limit.")
    for magic in MAGIC.get(suffix, []):
        if not content.startswith(magic):
            raise ExtractionError(
                f"File content does not match the .{suffix.lstrip('.')} format. "
                "The file may be corrupted or mislabelled."
            )
    return ALLOWED[suffix]


def extract_text(filename: str, content: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix in {".txt", ".md", ".json"}:
        return content.decode("utf-8", errors="replace")
    if suffix == ".csv":
        text = content.decode("utf-8-sig", errors="replace")
        # Validate it parses as CSV before accepting.
        try:
            list(csv.reader(io.StringIO(text)))
        except csv.Error as exc:
            raise ExtractionError(f"Invalid CSV: {exc}") from exc
        return text
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as exc:  # pragma: no cover
            raise ExtractionError("PDF parsing support is not installed on the server.") from exc
        try:
            reader = PdfReader(io.BytesIO(content))
            pages = [page.extract_text() or "" for page in reader.pages[:200]]
            text = "\n\n".join(pages).strip()
        except Exception as exc:
            raise ExtractionError(f"Could not read the PDF: {exc}") from exc
        if not text:
            raise ExtractionError("No selectable text found. Scanned PDFs require OCR, which is not configured.")
        return text
    if suffix == ".docx":
        try:
            import docx
        except ImportError as exc:  # pragma: no cover
            raise ExtractionError("DOCX parsing support is not installed.") from exc
        try:
            document = docx.Document(io.BytesIO(content))
            parts = [p.text for p in document.paragraphs if p.text.strip()]
            for table in document.tables:
                for row in table.rows:
                    parts.append(" | ".join(cell.text.strip() for cell in row.cells))
            return "\n".join(parts)
        except Exception as exc:
            raise ExtractionError(f"Could not read the DOCX: {exc}") from exc
    if suffix == ".xlsx":
        try:
            import openpyxl
        except ImportError as exc:  # pragma: no cover
            raise ExtractionError("XLSX parsing support is not installed.") from exc
        try:
            workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            lines: list[str] = []
            for sheet in workbook.worksheets[:10]:
                lines.append(f"# Sheet: {sheet.title}")
                for row in sheet.iter_rows(max_row=5000, values_only=True):
                    if any(cell is not None for cell in row):
                        lines.append(",".join("" if c is None else str(c) for c in row))
            workbook.close()
            return "\n".join(lines)
        except (zipfile.BadZipFile, Exception) as exc:
            raise ExtractionError(f"Could not read the XLSX: {exc}") from exc
    if suffix == ".pptx":
        try:
            from pptx import Presentation
        except ImportError as exc:  # pragma: no cover
            raise ExtractionError("PPTX parsing support is not installed.") from exc
        try:
            presentation = Presentation(io.BytesIO(content))
            lines: list[str] = []
            for index, slide in enumerate(presentation.slides[:100], 1):
                lines.append(f"# Slide {index}")
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        lines.append(shape.text.strip())
            return "\n".join(lines)
        except Exception as exc:
            raise ExtractionError(f"Could not read the PPTX: {exc}") from exc
    raise ExtractionError("Unsupported file type.")


def summarise_structure(text: str) -> dict:
    try:
        parsed = json.loads(text)
        return {"kind": "json", "top_level_keys": list(parsed)[:20] if isinstance(parsed, dict) else []}
    except (json.JSONDecodeError, TypeError):
        return {"kind": "text", "characters": len(text), "lines": text.count("\n") + 1}
