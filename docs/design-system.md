# Design system — the intelligence grimoire

ASTA's interface is an original dark-grimoire language inspired by the mood of *Black Clover* — not a
reproduction of its characters, symbols, typography or artwork. No copyrighted anime assets are used.
The five-leaf emblem is an original geometric composition drawn in `apps/web/src/components/brand/Emblem.tsx`.

The guiding idea: **a living grimoire that answers to you**. Antique gold rules and parchment text
sit over obsidian surfaces and crimson energy; magic is reserved for moments of intent (opening,
summoning, approval), while the working interface stays legible, calm and fast.

## Palette

| Token | Hex | Role |
| --- | --- | --- |
| `abyss` | `#08090D` | Page background |
| `coal` | `#101117` | Raised surfaces, sidebars |
| `panel` | `#151720` | Cards and dialogs |
| `elevated` | `#1B1E29` | Inputs, hover surfaces |
| `crimson` | `#8B1E2D` | Deep brand red, gradients |
| `ember` | `#B52C43` | Active accent, primary actions |
| `arcane` | `#7957C8` | Secondary magical accent |
| `gold` | `#C6A66A` | Rules, eyebrows, focus, citations |
| `parchment` | `#F5F2ED` | Primary text |
| `ash` | `#9B9CAA` | Secondary text |
| `line` | `#292B38` | Borders and dividers |
| `success` | `#45A77B` | Ready, approved, online |
| `danger` | `#D64A56` | Failure, destructive actions |

High contrast raises `--ash`, `--line` and `--panel` and suppresses the noise overlay. The palette is
defined once in `src/styles/index.css` and mapped in `tailwind.config.js`.

## Typography

- **Cinzel** — display, titles, the wordmark. Used with generous tracking for a ritual feel.
- **Inter** — body and UI. Tight line lengths, 0.9–1rem for dense panels.
- **JetBrains Mono** — code, IDs, model names, status tokens.

Eyebrows are uppercase, 0.68rem, 0.22em tracking, ash. Body copy is parchment at ~92% opacity for
comfortable long reading.

## Surfaces and ornament

- `.panel` — angled gradient from elevated to coal, 1px line border, 0.875rem radius, deep soft shadow.
- `.grimoire-corners` — partial gold corner marks; used sparingly on hero panels and dialogs.
- `.rune-divider` — hairline gold gradient with a centered `✦`.
- `.nav-item` — active state uses a crimson wash and a gold-to-ember rail.
- `ParticleField` — slow, low-opacity drifting embers in hero areas.
- `GrimoireIntro` — one-time cover-opening animation, stored in `localStorage` and skipped by Esc.

Ornament never blocks reading. No image is required for the visual identity to work.

## Components

- Buttons: `.btn-primary` (crimson gradient with gold border), `.btn-ghost`, `.btn-quiet`,
  `.btn-danger`. All expose `:focus-visible` rings.
- Fields: `.input` with coal fill, line border, gold focus ring.
- Badges: neutral, gold, crimson, success, warning, danger, arcane. Status dots carry a soft glow.
- Cards: `.panel` and `.panel-interactive` (2px lift on hover).
- Chat: user turns are compact parchment blocks; assistant turns are open prose with agent activity
  and citations. The composer is a floating rune-sealed input with attachments, language and voice.
- Agent activity: a vertical event ledger with live state; no fake conversations between agents.
- Tasks: expandable ledger with step rails, approvals, logs and outputs.
- Toasts: bottom-right, tone-coded, announced via `aria-live="polite"`.
- Command palette: `Ctrl/Cmd+K`, full keyboard navigation.

## Motion

Motion communicates state, never decorates idle content:

- Page/panel entrance: short fade and 8–14px rise.
- Hero particles: slow drift; disabled by reduced motion.
- Grimoire intro: cover rotation, ~1.05s, collapses to 50ms under reduced motion.
- Streaming: a single pulse for active work; no bouncing skeletons.

`prefers-reduced-motion` and the `reduced_motion` preference both collapse transitions and animation
to near-zero. Framer Motion's `useReducedMotion` is used for the intro.

## Accessibility

- Semantic landmarks, skip link, labelled navigation and dialogs with focus trapping.
- Visible focus rings on every interactive element; minimum 24px hit areas for icon buttons.
- Status is never conveyed by color alone — every colored badge includes text or an icon.
- Text scaling at 90/100/112/125% and a high-contrast mode.
- RTL support: logical properties (`start`/`end`, `ms-`/`me-`), mirrored nav rails and markdown lists.
- Live regions for toasts, streaming status and form errors.
- Keyboard-first: command palette, Escape to close, focus restoration, Enter/Shift+Enter in composer.

## Language and tone

The interface speaks with quiet confidence. It explains what is happening, labels uncertainty, and
never claims a capability the server cannot prove. "Demo composer", "not configured", "requires
approval" and "unverified" are visible states — not buried in documentation.

## Do and don't

**Do**

- Use crimson for intent, gold for structure, parchment for meaning.
- Keep dark surfaces layered (abyss → coal → panel → elevated).
- Label every demo, unverified or unavailable state.
- Prefer thin rules, small caps and restrained glow over heavy decoration.
- Test with reduced motion, 125% text, high contrast and RTL.

**Don't**

- Recreate anime characters, sigils, screenshots or logos.
- Add neon gradients, glassmorphism or generic purple SaaS accents.
- Animate large areas continuously.
- Hide a limitation behind a tooltip or marketing copy.
- Use color as the only signal.
