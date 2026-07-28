# CLAUDE.md — AirDoodle

You are building AirDoodle: a mobile webapp where the user draws a cartoon in the air via front camera (pinch to draw) and it comes alive (physics + procedural animation + hand reactivity).

**Read SPEC.md (what & why) and BUILD_PLAN.md (how & in what order) before writing any code.** Decisions in SPEC.md §2 are settled — do not relitigate them. If something is genuinely ambiguous or a decision proves technically wrong, STOP and ask Ham; do not silently pick.

## Hard Constraints

1. **Zero cost.** Client-side only. No servers, APIs, keys, accounts, databases. Hosting = GitHub Pages.
2. **No build step.** Vanilla JS. Libraries via CDN `<script>` tags only (MediaPipe Hands, matter.js). Repo = `index.html` + `app.js` + `README.md`. Nothing else.
3. **Mobile-first.** Portrait, front camera, mirrored. Perf budget in BUILD_PLAN.md is binding.
4. **Phase order is binding.** Complete each phase's Verify step (Ham tests on his real phone via the deployed URL) before starting the next. Kill gates in P1 and P3 are real — report honestly if hit.
5. **One hand tracked. Max 5 creatures. Pinch = draw. Closed fist 0.6s (or button) = alive.**

## Working Style (Karpathy rules — follow strictly)

- **Simplicity first.** Minimum code that solves the phase. No speculative abstractions, no config options nobody asked for, no error handling for impossible cases. If a function could be half as long, make it so.
- **Surgical changes.** When iterating, touch only what the feedback requires. Don't reformat or "improve" untouched code.
- **Surface assumptions.** Before each phase, state in 2–3 bullets what you're assuming and what could go wrong. If multiple interpretations exist, present them — don't pick silently.
- **Verifiable goals.** Each phase ends with its Verify check. "It should work" is not done; Ham confirming on his phone is done.

## Communication with Ham

- Direct, concise, bullets. Metrics first. No filler, no long preambles.
- Label (fact) vs (opinion).
- One question at a time when a decision is needed.
- After each phase: report what shipped, the deployed URL, what to test, known issues.
- Ask before creating any file beyond the 3 allowed repo files.

## Known Risk Areas (handle as specified, don't rabbit-hole)

- **iOS Safari MediaRecorder** (P4): timebox 1 hour → fallback to screenshot-only on iOS.
- **Pinch jitter** (P2): hysteresis + 3-frame vote is the specified fix; tune thresholds, don't redesign.
- **Physics body shape** (P3): circle body first; convex hull only if circle feels wrong in Ham's test.

## Commands

- No build, no package manager, no test runner — vanilla JS served as static files.
- Local dev: serve the directory over HTTP(S) (camera access needs `localhost` or HTTPS, not `file://`), e.g. `npx serve` or `python -m http.server`, then open on a phone via LAN IP or deploy to GitHub Pages to test on Ham's real device.
- Deploy: push to the GitHub Pages branch/remote (see repo remote) — there is no separate build step.
- **Every time `app.js` changes, bump the `?v=N` query param on the `<script src="app.js?v=N">` line in `index.html`.** Without it, GitHub Pages/mobile Safari serve a stale cached `app.js` during testing.
- Debug FPS counter: append `?debug=1` to the deployed URL.

## Architecture

Everything lives in `app.js` (single file, no modules) driven by one `onResults` callback from MediaPipe Hands per frame, plus a decoupled `stepPhysics` tick. Rough pipeline, in call order:

1. **Hand tracking** (`startHandTracking`, `onResults`) — MediaPipe Hands (lite, 1 hand) feeds landmarks each frame.
2. **Gesture detection** (`updatePinch`, `checkFist`, `fingerExtended`, `dist`) — turns raw landmarks into pinch (pen down/up) and fist-hold ("alive") events, with hysteresis/smoothing per SPEC §4.
3. **Drawing** (`addPoint`, `drawStrokes`, `bboxOfStrokes`) — pinch-down accumulates points into the active stroke; strokes are plain point arrays rendered as polylines.
4. **Bringing alive** (`bringAlive`) — rasterizes finished strokes to an offscreen canvas (sprite), computes bounds, and creates a matter.js circle body (`setupWalls` for the world edges).
5. **Physics + procedural life** (`stepPhysics`, `drawCreatures`, `easeOut`, `drawStar`) — fixed-timestep matter.js tick decoupled from render; `drawCreatures` layers breathe/wiggle/blink/hop/startle animation on top of each sprite per SPEC §3.
6. **Recording** (`compositeFrame`, `startRecording`, `stopRecording`, `downloadBlob`, `updateRecTimer`, `flashRecordBtn`) — composites camera + canvas into one stream for `MediaRecorder`, with a manual download fallback for browsers where the Web Share API/MediaRecorder path fails.

There is one shared mutable state blob (strokes array, creatures array, hand landmark state) that all of the above read/write directly — no event bus, no framework. When changing one stage, check the others for direct references to that shared state rather than assuming isolation.
