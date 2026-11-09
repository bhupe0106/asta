"""Original procedural artwork.

ASTA does not ship a diffusion model. Instead of pretending, it generates
original vector sigils and motion graphics from the request itself. Every file
is deterministic for the same prompt and is clearly labelled as procedural.
"""
from __future__ import annotations

import hashlib
import math
import random
import uuid
from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings

PALETTE = ("#B52C43", "#7957C8", "#C6A66A", "#45A77B", "#D64A56", "#F5F2ED")


@dataclass
class Artifact:
    id: str
    filename: str
    path: Path
    kind: str
    mode: str
    url: str


def _seed(prompt: str) -> int:
    return int(hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:12], 16)


def _svg(prompt: str, kind: str) -> str:
    rng = random.Random(_seed(prompt))
    width, height = (1024, 1024) if kind == "image" else (1280, 720)
    cx, cy = width / 2, height / 2
    accent = PALETTE[rng.randrange(len(PALETTE))]
    secondary = PALETTE[rng.randrange(len(PALETTE))]
    if accent == secondary:
        secondary = "#C6A66A"
    petals = 5 + rng.randrange(0, 4)
    ring_count = 3 + rng.randrange(0, 3)
    rotation = rng.uniform(0, 360)
    stars = [
        (rng.uniform(0, width), rng.uniform(0, height), rng.uniform(0.6, 2.2), rng.uniform(0.15, 0.75))
        for _ in range(90)
    ]

    def petal_path(radius: float, spread: float) -> str:
        return (
            f"M {cx:.1f} {cy - radius * 0.18:.1f} "
            f"C {cx - spread:.1f} {cy - radius * 0.95:.1f}, {cx - spread * 0.72:.1f} {cy + radius * 0.55:.1f}, "
            f"{cx:.1f} {cy + radius:.1f} "
            f"C {cx + spread * 0.72:.1f} {cy + radius * 0.55:.1f}, {cx + spread:.1f} {cy - radius * 0.95:.1f}, "
            f"{cx:.1f} {cy - radius * 0.18:.1f} Z"
        )

    petal_group = []
    for index in range(petals):
        angle = 360 / petals * index
        opacity = 0.34 + (index % 3) * 0.08
        petal_group.append(
            f'<path d="{petal_path(210 + rng.uniform(-18, 18), 96 + rng.uniform(-10, 10))}" '
            f'fill="url(#petal)" opacity="{opacity:.2f}" '
            f'transform="rotate({angle:.2f} {cx:.1f} {cy:.1f})" />'
        )

    rings = []
    for index in range(ring_count):
        radius = 120 + index * 52 + rng.uniform(-8, 8)
        dash = f"{rng.uniform(2, 16):.1f} {rng.uniform(6, 22):.1f}"
        rings.append(
            f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{radius:.1f}" fill="none" '
            f'stroke="{secondary}" stroke-opacity="{0.5 - index * 0.09:.2f}" stroke-width="{1.6 - index * 0.2:.2f}" '
            f'stroke-dasharray="{dash}" />'
        )

    runes = []
    for index in range(12):
        angle = math.radians(index * 30 + rotation)
        radius = 320 + rng.uniform(-12, 12)
        x = cx + math.cos(angle) * radius
        y = cy + math.sin(angle) * radius
        runes.append(
            f'<rect x="{x - 2:.1f}" y="{y - 11:.1f}" width="4" height="22" rx="1" '
            f'fill="{accent}" opacity="0.55" transform="rotate({math.degrees(angle) + 90:.1f} {x:.1f} {y:.1f})" />'
        )

    star_markup = "".join(
        f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{PALETTE[5]}" opacity="{o:.2f}" />'
        for x, y, r, o in stars
    )

    motion = ""
    if kind == "video":
        motion = f"""
  <animateTransform attributeName="transform" type="rotate" from="0 {cx:.1f} {cy:.1f}" to="360 {cx:.1f} {cy:.1f}" dur="34s" repeatCount="indefinite" />
"""
        animation = f"""
  <g>
    <animateTransform attributeName="transform" type="rotate" from="{rotation:.1f} {cx:.1f} {cy:.1f}" to="{rotation + 360:.1f} {cx:.1f} {cy:.1f}" dur="28s" repeatCount="indefinite" />
    {''.join(petal_group)}
  </g>
  <g opacity="0.85">
    <animateTransform attributeName="transform" type="rotate" from="360 {cx:.1f} {cy:.1f}" to="0 {cx:.1f} {cy:.1f}" dur="46s" repeatCount="indefinite" />
    {''.join(rings)}
  </g>
  <circle cx="{cx:.1f}" cy="{cy:.1f}" r="9" fill="{PALETTE[5]}">
    <animate attributeName="opacity" values="0.45;1;0.45" dur="4s" repeatCount="indefinite" />
  </circle>
"""
    else:
        animation = f"""
  <g transform="rotate({rotation:.1f} {cx:.1f} {cy:.1f})">{''.join(petal_group)}</g>
  {''.join(rings)}
  <circle cx="{cx:.1f}" cy="{cy:.1f}" r="7" fill="{PALETTE[5]}" />
"""

    label = "PROCEDURAL MOTION SIGIL" if kind == "video" else "PROCEDURAL SIGIL"

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="ASTA {label.lower()}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#1B1E29" />
      <stop offset="55%" stop-color="#101117" />
      <stop offset="100%" stop-color="#08090D" />
    </radialGradient>
    <radialGradient id="petal" cx="50%" cy="38%" r="65%">
      <stop offset="0%" stop-color="{accent}" stop-opacity="0.95" />
      <stop offset="100%" stop-color="{secondary}" stop-opacity="0.28" />
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="0.6" /></filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <g filter="url(#soft)">{star_markup}</g>
  <g>
    <animateTransform attributeName="transform" type="rotate" from="0 {cx:.1f} {cy:.1f}" to="360 {cx:.1f} {cy:.1f}" dur="90s" repeatCount="indefinite" />
    {''.join(runes)}
  </g>
  {animation}
  <text x="{width - 32}" y="{height - 28}" text-anchor="end" font-family="monospace" font-size="13" letter-spacing="3" fill="#9B9CAA" opacity="0.7">{label} · ASTA</text>
</svg>
"""


def media_path() -> Path:
    path = Path(settings.media_dir)
    if not path.is_absolute():
        path = settings.base_path / path
    path.mkdir(parents=True, exist_ok=True)
    return path


def generate_artifact(prompt: str, kind: str = "image") -> Artifact:
    kind = "video" if kind == "video" else "image"
    slug = uuid.uuid4().hex
    filename = f"{slug}.svg"
    target = media_path() / filename
    target.write_text(_svg(prompt, kind), encoding="utf-8")
    return Artifact(
        id=slug,
        filename=filename,
        path=target,
        kind=kind,
        mode="procedural-svg" if kind == "image" else "procedural-animation",
        url=f"{settings.api_prefix}/media/files/{filename}",
    )
