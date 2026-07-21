# SPEC — "AirToon" (working name)

**Version:** 1.0 · **Date:** 2026-07-20 · **Owner:** Ham
**One-liner:** A mobile webapp where you draw a cartoon in the air with your finger (via front camera), and the drawing comes alive — it breathes, grows eyes, hops around, obeys physics, and reacts to your hand.

---

## 1. Concept

- User props phone up, front camera on, sees mirrored self on screen.
- Pinch (index + thumb) = pen down. Move hand = draw a glowing stroke in the air. Release pinch = pen up (multi-stroke drawings supported).
- Hold open palm ~1 second (or tap fallback button) = drawing "comes alive":
  - Strokes merge into one sprite/creature.
  - Procedural life: breathing squash-and-stretch, wiggle, auto-stamped blinking eyes, occasional hops.
  - Physics: gravity, bounces off screen edges and floor (matter.js).
  - Hand reactivity: user's hand is a physics body — creatures can be batted, pushed, juggled.
- Max 3 creatures alive; creating a 4th fades out the oldest.
- Record button: 15-second video clip → native share sheet.

## 2. Decision Log

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Meaning of "alive" | Reactive + physics + procedural motion (fake-rig) | True auto-rigging (Meta Animated Drawings) needs server-side ML → breaks zero-cost; fails on messy air strokes (fact). Fake-rig works on any scribble, preserves drawing freedom. |
| D2 | Motion approach | Fake-rig / procedural (breathe, wiggle, eyes, hop) | Easiest path chosen explicitly by Ham. Guided-drawing real rig → v1.1 backlog. |
| D3 | Platform | Mobile-first (portrait, front camera, mirrored) | Ham's call. Constraints accepted: phone must be propped; MediaPipe lite model; capped physics. Desktop = should still work but untested/unoptimized in v1. |
| D4 | Draw gesture | Pinch = pen down/up | Reliable in MediaPipe (fact); enables multi-stroke; no screen touching. |
| D5 | Hands tracked | ONE hand only | Two-hand tracking ~halves mobile frame rate (fact); hands occlude on narrow front cam. |
| D6 | "Alive" trigger | Closed fist held ~1s + fallback on-screen button | Changed from open palm during P3 testing — open palm false-triggered during pinch/draw (relaxed fingers read as extended). Fist is more distinct from the pinch pose. |
| D7 | Creature cap | 3, oldest fades out | Mobile perf budget (physics + tracking). |
| D8 | Share | 15s video recording via MediaRecorder + Web Share API | Screenshot loses the animation (the whole point). iOS Safari risk accepted — see §6. |
| D9 | Stack | Vanilla JS, single HTML page, MediaPipe Hands (lite), matter.js, GitHub Pages | One render loop; React adds nothing (karpathy: simplicity first). Zero cost. |
| D10 | Drawing style | One bold stroke style, random fun color per creature, no color UI | Less mobile UI; charm through randomness. |
| D11 | Cost | $0 — all client-side, free static hosting | Hard constraint. No servers, no APIs, no keys. |
| D12 | LINE relation | None | Personal project, explicitly not LINE-related. |

## 3. Creature Behavior Spec (procedural life)

When brought alive, a creature = merged strokes rendered to an offscreen canvas → texture on a physics body (convex hull or bounding circle of strokes).

Idle behaviors (looping, randomized timing):
- **Breathe:** scaleY oscillates 1.0 ↔ 1.06, ~2s cycle
- **Wiggle:** small rotation ±3°, perlin-ish noise
- **Eyes:** 2 white circles + pupils auto-placed in upper third of sprite bounds; blink every 3–6s; pupils look toward user's hand
- **Hop:** every 5–12s, apply small upward impulse
- **Fade-out (death):** 1.5s opacity fade when evicted by cap

Reactivity:
- User's tracked index fingertip + palm center = kinematic circle bodies in the physics world → collisions push creatures
- Creature "startles" (quick squash + eyes wide) on hand collision

## 4. Gesture Spec

| Gesture | Detection | Action |
|---------|-----------|--------|
| Pinch | thumb tip–index tip distance < threshold (normalized by hand size) | Pen down; draw at index tip |
| Pinch release | distance > threshold + hysteresis | Pen up (stroke ends) |
| Fist 1s | all 4 fingers curled (MediaPipe landmarks), held 1s, only when ≥1 stroke exists | Bring drawing alive |
| (fallback) | On-screen "✨ Alive" button | Same as fist |

Hysteresis and 3-frame smoothing on all gesture detections to avoid flicker.

## 5. UI (minimal)

- Full-screen mirrored camera feed, strokes + creatures overlaid on canvas
- Bottom bar: [✨ Alive] [⏺ Record 15s] [🗑 Clear]
- First-run overlay: "Prop your phone up. Pinch to draw. Open your palm to bring it to life." (3 icons, dismiss on first pinch)
- No accounts, no settings, no persistence

## 6. Risks & Mitigations

| Risk | Level | Mitigation |
|------|-------|-----------|
| iOS Safari MediaRecorder quirks | Med | Test early (P4 gate). Fallback: iOS gets screenshot-only, documented known-issue. |
| Mobile perf (tracking + physics) | Med | MediaPipe lite model, 1 hand, cap 3 creatures, physics at 30Hz, render via requestAnimationFrame with frame skip. |
| Pinch misfires / jitter | Low | Hysteresis + smoothing (§4); fallback button. |
| Camera permission denied | Low | Friendly retry screen. |

## 7. Kill Criteria

- If P1 (hand tracking) can't hold ≥15fps on Ham's phone → stop, don't build on a laggy foundation.
- If the "alive moment" (P3 demo) doesn't feel delightful to Ham within 2 iteration rounds → park project.

## 8. Backlog (explicitly out of v1)

- Guided-drawing mode with real limb rig + walk cycle
- Two-hand mode
- Desktop optimization
- Color picker / brush styles
- Drop-in physics props (balls, platforms)
- Sound effects
- Creature persistence between sessions
