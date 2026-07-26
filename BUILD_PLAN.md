# BUILD_PLAN — AirDoodle

Phased. Each phase ends with a verifiable check (karpathy: goal-driven execution). Do NOT start a phase until the previous phase's check passes on a real phone.

**Test device:** Ham's phone (mobile Safari or Chrome). Deploy each phase to GitHub Pages so Ham can test — camera APIs require HTTPS (fact), so localhost-only testing is insufficient.

---

## P0 — Skeleton & Deploy (~30 min)

- Single `index.html` (inline CSS/JS or one `app.js` — max 2 files total)
- GitHub repo + GitHub Pages enabled
- Page requests front camera, shows mirrored full-screen video

**Verify:** Ham opens URL on phone → sees mirrored self full-screen. Permission-denied shows retry message.

## P1 — Hand Tracking (~half day)

- MediaPipe Hands via CDN, `modelComplexity: 0` (lite), `maxNumHands: 1`
- Draw a dot on index fingertip, small circle on palm center
- FPS counter (debug flag, e.g. `?debug=1`)

**Verify:** ≥15fps sustained on Ham's phone with hand in frame; dot tracks fingertip with no visible rubber-banding. **KILL GATE: if <15fps after tuning, stop project.**

## P2 — Air Drawing (~half day)

- Pinch detection: thumb-tip↔index-tip distance normalized by wrist↔index-MCP distance; threshold + hysteresis + 3-frame vote
- Pen down → append smoothed points to current stroke; pen up → close stroke
- Render strokes as bold round-cap polylines, one random color per future creature (color assigned at first stroke)
- Clear button

**Verify:** Ham can draw a smiley face (circle + 2 eyes + mouth = 4 separate strokes) recognizably. Pinch false-positive rate feels acceptable in 1 min of casual hand movement.

## P3 — ALIVE: creature + physics + reactivity (~1–2 days) ← the heart

1. Open-palm-1s detection + ✨ button → "alive" event
2. Rasterize current strokes to offscreen canvas → sprite; compute bounds
3. matter.js world: gravity, walls = screen edges; creature = circle body (radius from stroke bounds) with sprite rendered on top — **start with circle body, not convex hull; upgrade only if it feels wrong**
4. Procedural life per SPEC §3: breathe, wiggle, blinking eyes with pupil-tracking, random hops, startle on collision
5. Hand bodies: fingertip + palm as kinematic circles that push creatures
6. Cap 5 creatures, oldest fades out over 1.5s
7. Physics at fixed 30Hz timestep decoupled from render

**Verify (the delight test):** Draw a blob → open palm → it drops, bounces, breathes, blinks, looks at your hand. Bat it with your hand → it flies and startles. Ham grins. ≥15fps with 5 creatures. **KILL GATE: if not delightful after 2 tuning rounds, park project.**

## P4 — Record & Share (~half day)

- Composite camera + canvas into one recording canvas
- MediaRecorder on `canvas.captureStream(30)`, 15s max, auto-stop
- Web Share API → native sheet; fallback: download link
- **Test iOS Safari FIRST.** If broken after 1 hour of attempts: iOS gets screenshot-only, add to known issues, move on. Do not rabbit-hole.

**Verify:** Ham records a 15s clip on his phone and shares it to LINE chat successfully (or iOS fallback documented).

## P5 — Polish (~half day, timeboxed)

- First-run overlay (3-icon instructions, dismiss on first pinch)
- Bottom bar styling, safe-area insets
- Friendly camera-denied screen

**Verify:** A friend uses it with zero verbal instructions and creates a living creature within 2 minutes.

---

## Perf Budget (hard numbers)

| Thing | Budget |
|---|---|
| FPS with 5 creatures | ≥15 |
| MediaPipe model | lite (complexity 0), 1 hand |
| Physics tick | 30Hz fixed |
| Max stroke points per drawing | 2,000 (drop-oldest beyond) |
| Total JS payload (excl. CDN libs) | <50KB |
| Files in repo | index.html + app.js + README only |

## Explicit Non-Goals (do not build)

No frameworks, no bundler, no npm build step, no TypeScript, no server, no analytics, no state library, no tests-for-the-sake-of-tests (the verify steps above ARE the tests), no features from SPEC §8 backlog.
