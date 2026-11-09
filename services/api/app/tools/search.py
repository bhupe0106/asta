"""Search and page retrieval.

Only real, configured providers are used. When none is configured the
Researcher reports that clearly instead of inventing results.

Providers:
- ``searxng``    — a self-hosted SearXNG JSON endpoint.
- ``duckduckgo`` — the public HTML endpoint (no key required).
- ``wikipedia``  — the MediaWiki search API (no key required).

Page retrieval is SSRF-guarded: only public http(s) hosts are fetched and the
response size, content type and redirect chain are bounded.
"""
from __future__ import annotations

import asyncio
import html
import ipaddress
import re
import socket
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import parse_qs, quote, unquote, urljoin, urlparse

import httpx

from app.core.config import settings


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str


class SearchUnavailable(RuntimeError):
    pass


class FetchUnavailable(RuntimeError):
    pass


USER_AGENT = "ASTA/0.1 (local-first research; +https://github.com/asta)"
MAX_PAGE_BYTES = 2_000_000
MAX_REDIRECTS = 3


# ---------------------------------------------------------------------------
# Minimal HTML helpers
# ---------------------------------------------------------------------------
class _TextExtractor(HTMLParser):
    """Strip tags and keep readable text, ignoring script/style/noscript."""

    BLOCKED = {"script", "style", "noscript", "svg", "template", "nav", "footer", "form"}
    BREAKING = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._blocked_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        if tag in self.BLOCKED:
            self._blocked_depth += 1
        if tag in self.BREAKING and self._blocked_depth == 0:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.BLOCKED and self._blocked_depth:
            self._blocked_depth -= 1
        if tag in self.BREAKING and self._blocked_depth == 0:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._blocked_depth == 0:
            self.parts.append(data)


def strip_html(raw: str, limit: int = 8000) -> str:
    parser = _TextExtractor()
    try:
        parser.feed(raw)
        parser.close()
    except Exception:  # malformed markup should never fail retrieval
        pass
    text = html.unescape("".join(parser.parts))
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
    return text[:limit]


class _DuckDuckGoParser(HTMLParser):
    """Collect result anchors and snippets from the DuckDuckGo HTML page."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.results: list[dict[str, str]] = []
        self._mode: str | None = None
        self._current: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        if tag != "a":
            return
        attr = dict(attrs)
        classes = (attr.get("class") or "").split()
        if "result__a" in classes:
            self._mode = "title"
            self._current = {"url": attr.get("href", ""), "title": "", "snippet": ""}
            self.results.append(self._current)
        elif "result__snippet" in classes and self.results:
            self._mode = "snippet"

    def handle_endtag(self, tag: str) -> None:
        if tag == "a":
            self._mode = None

    def handle_data(self, data: str) -> None:
        if self._mode == "title" and self.results:
            self.results[-1]["title"] += data
        elif self._mode == "snippet" and self.results:
            self.results[-1]["snippet"] += data


def _unwrap_duckduckgo_url(url: str) -> str:
    if url.startswith("//"):
        url = "https:" + url
    parsed = urlparse(url)
    if parsed.netloc.endswith("duckduckgo.com") and parsed.path.startswith("/l/"):
        target = parse_qs(parsed.query).get("uddg")
        if target:
            return unquote(target[0])
    return url


def _is_public_host(host: str) -> bool:
    if not host:
        return False
    if host.lower() in {"localhost", "localhost.localdomain"}:
        return False
    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(host, None)}
    except OSError:
        return False
    for address in addresses:
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            return False
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return False
    return True


def _validate_public_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise FetchUnavailable("Only http(s) URLs can be fetched.")
    if not parsed.hostname or not _is_public_host(parsed.hostname):
        raise FetchUnavailable("That URL points to a private or unresolved host; it was not fetched.")
    return url


async def fetch_page_text(url: str, limit: int = 5000) -> str:
    """Fetch a public page and return extracted text.

    Redirects are followed manually so every hop is re-validated.
    """
    current = _validate_public_url(url)
    async with httpx.AsyncClient(
        timeout=settings.web_fetch_timeout_seconds,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,text/plain"},
    ) as client:
        for _hop in range(MAX_REDIRECTS + 1):
            try:
                async with client.stream("GET", current) as response:
                    if response.status_code in (301, 302, 303, 307, 308):
                        location = response.headers.get("location")
                        if not location:
                            raise FetchUnavailable("Redirect without a destination.")
                        current = _validate_public_url(urljoin(current, location))
                        continue
                    if response.status_code != 200:
                        raise FetchUnavailable(f"Page returned HTTP {response.status_code}.")
                    content_type = (response.headers.get("content-type") or "").split(";")[0].strip().lower()
                    if content_type not in ("text/html", "application/xhtml+xml", "text/plain"):
                        raise FetchUnavailable(f"Unsupported content type: {content_type or 'unknown'}.")
                    chunks: list[bytes] = []
                    total = 0
                    async for chunk in response.aiter_bytes():
                        total += len(chunk)
                        if total > MAX_PAGE_BYTES:
                            break
                        chunks.append(chunk)
                    raw = b"".join(chunks).decode(response.encoding or "utf-8", errors="replace")
                    return strip_html(raw, limit=limit)
            except httpx.HTTPError as exc:
                raise FetchUnavailable(f"Page retrieval failed: {exc}") from exc
    raise FetchUnavailable("Too many redirects.")


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------
async def _searxng(query: str, limit: int) -> list[SearchResult]:
    if not settings.searxng_url:
        raise SearchUnavailable(
            "SearXNG is selected but ASTA_SEARXNG_URL is empty. Set it or switch ASTA_SEARCH_PROVIDER."
        )
    try:
        async with httpx.AsyncClient(timeout=settings.web_fetch_timeout_seconds) as client:
            res = await client.get(
                f"{settings.searxng_url.rstrip('/')}/search",
                params={"q": query, "format": "json", "safesearch": 1},
                headers={"User-Agent": USER_AGENT},
            )
            res.raise_for_status()
            data = res.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise SearchUnavailable(f"Search provider error: {exc}") from exc
    return [
        SearchResult(
            title=item.get("title", "Untitled"),
            url=item.get("url", ""),
            snippet=item.get("content", ""),
        )
        for item in data.get("results", [])[:limit]
    ]


async def _duckduckgo(query: str, limit: int) -> list[SearchResult]:
    try:
        async with httpx.AsyncClient(timeout=settings.web_fetch_timeout_seconds) as client:
            res = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": USER_AGENT},
            )
            res.raise_for_status()
    except httpx.HTTPError as exc:
        raise SearchUnavailable(f"DuckDuckGo search failed: {exc}") from exc

    parser = _DuckDuckGoParser()
    parser.feed(res.text)
    results: list[SearchResult] = []
    for item in parser.results:
        url = _unwrap_duckduckgo_url(item["url"])
        if not url.startswith(("http://", "https://")):
            continue
        results.append(
            SearchResult(
                title=strip_html(item["title"], limit=200) or "Untitled",
                url=url,
                snippet=strip_html(item["snippet"], limit=500),
            )
        )
        if len(results) >= limit:
            break
    if not results:
        raise SearchUnavailable("DuckDuckGo returned no parseable results.")
    return results


async def _wikipedia(query: str, limit: int) -> list[SearchResult]:
    try:
        async with httpx.AsyncClient(timeout=settings.web_fetch_timeout_seconds) as client:
            res = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "format": "json",
                    "srlimit": limit,
                },
                headers={"User-Agent": USER_AGENT},
            )
            res.raise_for_status()
            data = res.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise SearchUnavailable(f"Wikipedia search failed: {exc}") from exc
    results: list[SearchResult] = []
    for item in data.get("query", {}).get("search", [])[:limit]:
        title = item.get("title", "Untitled")
        results.append(
            SearchResult(
                title=title,
                url=f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}",
                snippet=strip_html(item.get("snippet", ""), limit=500),
            )
        )
    if not results:
        raise SearchUnavailable("Wikipedia returned no results.")
    return results


async def web_search(query: str, limit: int = 5) -> list[SearchResult]:
    """Search using the configured provider, with an explicit honest failure."""
    provider = settings.search_provider
    if provider == "disabled":
        raise SearchUnavailable(
            "Web search is disabled. Set ASTA_SEARCH_PROVIDER=duckduckgo, wikipedia or searxng to enable sourced research."
        )
    if provider == "searxng":
        return await _searxng(query, limit)
    if provider == "duckduckgo":
        try:
            return await _duckduckgo(query, limit)
        except SearchUnavailable:
            # DuckDuckGo occasionally rate-limits the HTML endpoint. Wikipedia
            # is a real, independent fallback rather than a fabricated answer.
            return await _wikipedia(query, limit)
    if provider == "wikipedia":
        return await _wikipedia(query, limit)
    raise SearchUnavailable(f"Unknown search provider: {provider}")


async def enrich_with_pages(results: list[SearchResult], limit: int = 3) -> list[dict]:
    """Fetch readable text for the top results. Never fails the whole search."""

    async def one(result: SearchResult) -> dict:
        excerpt = ""
        error = ""
        try:
            excerpt = await fetch_page_text(result.url, limit=1800)
        except FetchUnavailable as exc:
            error = str(exc)
        return {
            "title": result.title,
            "url": result.url,
            "snippet": result.snippet,
            "excerpt": excerpt,
            "error": error,
        }

    return list(await asyncio.gather(*(one(result) for result in results[:limit])))
