# AGENTS.md — AirToon

Instructions for any coding agent (Codex, etc.) working in this repo.

## Project

AirToon: mobile webapp. Front camera + MediaPipe Hands. User pinches to draw strokes in the air; open-palm (or button) brings the drawing alive as a physics creature (matter.js) with procedural animation (breathe, wiggle, blinking eyes, hops) that reacts to the user's hand.

Source of truth:
- `SPEC.md` — product spec + settled decision log (§2). Do not change decisions without asking Ham.
- `BUILD_PLAN.md` — phased plan P0–P5 with per-phase Verify checks and perf budgets.

## Rules

1. **Stack:** Vanilla JS only. No frameworks, no bundlers, no npm, no TypeScript. Libraries via CDN script tags: MediaPipe Hands (lite model, 1 hand) and matter.js.
2. **Repo files:** `index.html`, `app.js`, `README.md` only. Do not add other files without explicit approval.
3. **Zero cost:** no servers, no API keys, no external services. Deploy target: GitHub Pages (HTTPS required for camera).
4. **Follow phase order** in BUILD_PLAN.md. A phase is done only when its Verify check passes on Ham's real phone. Respect kill gates (P1: ≥15fps; P3: delight test).
5. **Perf budgets are binding** (BUILD_PLAN.md table): ≥15fps with 5 creatures, physics 30Hz, ≤2,000 stroke points, <50KB own JS.
6. **Simplicity:** minimum code per phase. No speculative features, abstractions, or configs. Every changed line must trace to the current phase or explicit feedback.
7. **Non-goals** (do not build): anything in SPEC.md §8 backlog, tests frameworks, analytics, persistence, accounts, sound.

## Interaction contract with Ham

- Concise, bullets, metrics first. Label (fact) vs (opinion).
- One question at a time; provide a recommended answer with each question.
- Ask before creating files beyond the 3 allowed.
- If a settled decision (SPEC §2) proves technically wrong, stop and report — do not silently work around it.
- After each phase: report deployed URL + what to test + known issues.

## Gesture cheat-sheet (implement exactly)

| Gesture | Detection | Action |
|---|---|---|
| Pinch | thumb-tip↔index-tip dist, normalized by wrist↔index-MCP, threshold + hysteresis + 3-frame vote | pen down/up |
| Open palm 1s | 4 fingers extended, held 1s, ≥1 stroke exists | bring alive |
| Button ✨ | on-screen | same as open palm |

## Creature behavior (implement exactly, SPEC §3)

Breathe (scaleY 1.0↔1.06, ~2s) · wiggle (±3° noise) · auto eyes in upper third, blink 3–6s, pupils follow hand · hop impulse every 5–12s · startle on hand collision · fade-out 1.5s when evicted (cap 3).
