# HANDOFF — AirDoodle

**Last updated:** 2026-08-12 (review fix pass — verified on Ham's phone)
**Live URL:** https://chanooooot.github.io/airdoodle/ (repo: chanooooot/airdoodle, public — renamed from `sage` today; old `/sage/` links redirect via GitHub for a while, not forever)
**App name:** AirDoodle (renamed from AirToon — title, share sheet, filenames, all docs updated)

## Status: P0–P5 all shipped, plus a full review/polish pass

All phases from BUILD_PLAN.md are built and deployed. Did a full code/UX/design review
pass (plan: see git log around commits `033117b`..`8d234d4`; review plan file if still
present locally: `C:\Users\chano\.claude\plans\atomic-watching-dewdrop.md`), then a
rename + home-screen-icon pass on top.

## Review fix pass (2026-08-12)

An outsider end-to-end review of `app.js` (`/scrutinize`, whole file, not a diff) found
five defects. All five are fixed, deployed, and **verified on Ham's phone**. Cache
version is now `app.js?v=46`.

- **Recordings were mirrored regardless of camera.** `compositeFrame()` and the
  MediaRecorder-unavailable screenshot both applied `translate(w,0); scale(-1,1)`
  unconditionally, but the display only mirrors via `body.mirrored`, which
  `flipCamera()` removes on the back camera. Back-camera captures were saved as a
  mirror of what the user watched. Both paths now go through one `drawScene(c,w,h)`
  helper that flips only when `body.mirrored` is set. Front and back both confirmed
  correct on device.
- **The fist-hold progress ring strobed.** `f56c23c` moved gesture handling into
  `processFreshResult()`, which correctly runs once per MediaPipe result — but it took
  the ring's *drawing* with it. The canvas clears every `requestAnimationFrame` (~60Hz)
  while results arrive at tracking rate (~15-25Hz), so the ring was painted on roughly
  one frame in three, exactly during the 0.6s the user holds still waiting for feedback.
  `checkFist()` is now detection-only; a new `drawFistRing()` paints from the render loop
  after `drawCreatures()`, which also puts the ring above strokes/creatures instead of
  under them. Trigger timing is unchanged.
- **Stray 1-point strokes inflated the creature.** A pinch that opens on the very next
  frame leaves a stroke with exactly one point. `drawStrokes()` and the sprite render
  both skip those, but `bboxOfStrokes()` counted them — so the sprite canvas, the art
  offset, and the Matter circle radius were all sized around a point nobody can see.
  `bboxOfStrokes()` now applies the same `points.length < 2` skip as its two siblings.
- **Record button reverted mid-recording.** `flashRecordBtn()` restored the pre-flash
  `innerHTML` unconditionally after 2s, so starting a new recording inside that window
  left the button reading "Record" while actually recording. Restore is now guarded on
  `!recording`.
- **Download fallback could cancel itself.** `downloadBlob()` revoked the object URL
  synchronously after `a.click()`, which aborts the download on some WebKit builds —
  and this is the iOS no-MediaRecorder path that SPEC §6 names as the accepted risk.
  Revoke is now deferred 1s.

Not fixed, deliberately: SPEC.md D7 still says the creature cap is 3. Code, CLAUDE.md,
BUILD_PLAN.md and AGENTS.md all say 5. Doc drift only — SPEC's decision log is the stale
one.

Not verified: the iOS no-MediaRecorder screenshot path now routes through `drawScene()`.
No device without MediaRecorder was available to exercise it.

## Motion tracking reliability pass (2026-08-09)

Deployed. Its own checklist (below, under Next steps) has not been run end-to-end on
Ham's phone; the 2026-08-12 pass above did re-test the fist gesture and both recording
paths on device.

- MediaPipe results are numbered and gesture/physics processing runs once per
  fresh result. Pinch voting, smoothing, and stroke insertion cannot repeat on
  cached landmarks.
- Brief no-hand results stop points and move hand bodies offscreen immediately,
  while preserving an active stroke for 120ms. A return within that window resumes
  it; a longer loss clears the stroke and gesture votes.
- Camera-off clears landmarks, gesture state, timers, and hand bodies. Frame sends
  wait for a live, ready video stream; late camera-off errors stay quiet.
- ?debug=1 shows render FPS, MediaPipe-result FPS, sample age, normalized pinch
  distance/state, dropout count, stroke count, and point count.

Local checks passed: node --check app.js; own JS is 35,207 bytes (<50KB).
Current cache version is app.js?v=45.

## What's built

- **P0** Camera skeleton, mirrored full-screen, permission-denied retry screen
- **P1** MediaPipe hand tracking (1 hand, lite model), fingertip/palm tracking, FPS counter (`?debug=1`)
- **P2** Pinch-to-draw (hysteresis + 3-vote smoothing), multi-stroke, Undo (removes last stroke), Clear, stroke points capped at 2000 (drop-oldest, perf budget)
- **P3** matter.js physics — creatures spawn at drawn position (not falling), circle body, breathe/wiggle/blink/hop, hand-body collisions with startle reaction, cap 5 creatures w/ 1.5s fade-out oldest
- **P4** 15s recording (camera+canvas composite via MediaRecorder), Web Share API w/ download fallback, screenshot fallback if MediaRecorder unsupported. **Note:** a live countdown on the Record button was added then reverted per user request — button is plain `⏺ Record` / `⏹ Stop` again.
- **P5** First-run instruction overlay (shown before camera opens, camera starts on tap), flex bottom bar w/ safe-area insets, friendlier camera-denied copy
- **Extra (post-launch):** front/back camera flip toggle (🔄), camera on/off toggle (📷, privacy — fully stops tracks), birth effect (expanding color ring — was silently broken, now fixed + elastic wobble pop-in), fist-hold charge-up progress ring (makes the alive gesture legible), eyes/mouth tumble with body rotation instead of floating in screen space, experimental procedural smile, idle nudge hint after 4s of no drawing, active-draw-color swatch on Alive button, aria-labels on icon buttons, UI beautification pass (Fredoka/Nunito fonts, claymorphism-lite buttons, haptic feedback on Alive/Record, pulsing record button)
- **Home-screen icon + manifest:** canvas-drawn icon (orange→purple gradient rounded square, doodle face) generated at runtime in `app.js` (`setupAppIcon()`) — no image asset file needed, keeps the zero-extra-files constraint. Sets favicon, apple-touch-icon, and an inline (Blob URL) web app manifest for standalone Add-to-Home-Screen. Mouth position tuned per user feedback (moved up toward face center).

## Desktop playability (v1 was mobile-only per spec; now confirmed working)

Core loop (webcam → MediaPipe hand tracking → pinch-draw → physics) was already
device-agnostic, no mobile-only gate in code. One real bug blocked desktop use:
`flipCamera()` stopped the current stream *before* requesting the new facing
mode — on desktop (no back camera) that request fails, leaving video dead and
throwing up the camera-denied screen over one button tap. Fixed: request the
new stream first, only swap tracks if it succeeds; on failure (no alt camera)
just keep the existing stream running. SPEC.md §8 "Desktop optimization"
(layout/perf tuning for wide-aspect webcams, big-screen UI sizing) still
backlogged — only the actual blocker was fixed.

## Deviations from original SPEC.md

- **D6 changed:** "Alive" trigger is now **closed fist** (not open palm) — open palm false-triggered during pinch/draw since relaxed fingers read as extended. Hold time also tuned 1s → 0.6s for responsiveness. SPEC.md decision log already updated to reflect this.
- Hand collision hitboxes widened (fingertip 14→26px, palm 30→45px radius) to reduce tunneling on fast hand-bat motions and make index-finger poking easier to land — not in original spec, added for feel.

## Known issues / accepted limitations

- Hand tracking still drops when a hand exits camera FOV. A 120ms grace now avoids
  splitting brief edge losses; longer losses deliberately end the stroke.
- iOS Safari MediaRecorder — timeboxed test was done, confirmed working via user testing (if this regresses, screenshot fallback already in place, see `app.js` `startRecording()`).
- **SPEC.md D7 says the creature cap is 3. It is 5.** Code, CLAUDE.md, BUILD_PLAN.md and AGENTS.md agree on 5; only SPEC's decision log is stale. Don't "fix" the code to match SPEC.
- The iOS no-MediaRecorder screenshot path shares `drawScene()` with the video composite as of 2026-08-12, but has not been exercised on a device without MediaRecorder.
- Procedural smile (Tier 3.2 of the review) is explicitly experimental — it's live but not battle-tested on a wide variety of drawings. May look odd on abstract scribbles; watch for this and remove `app.js`'s "experimental: procedural smile" block if it doesn't read well.

## Cache-busting note

`index.html` loads `app.js?v=N` — **bump the version number every time app.js changes** or GitHub Pages/mobile Safari caching will serve stale JS during testing. Currently at v46. (Dated sections above quote whatever version was current when they were written — this line is the canonical one.)

## Title screen + tutorial + full sketch restyle (2026-07-29)

Replaced the old single "Start camera" first-run overlay with a proper title screen, and then did a full visual restyle. Nothing below has been verified on Ham's real phone yet.

**Title/tutorial split (`index.html`, `app.js`):**
- `#firstRun` replaced by `#titleScreen` (Play + How to Play buttons, no camera prompt yet) and `#tutorialScreen` (pinch/fist/alive steps 1-2-3, ends in its own Play button). Camera only starts (`startCamera()`) once a Play button is actually pressed, not on page load.
- Browser/hardware back button while on the tutorial screen used to leave the SPA and land on a stale cached copy of the page (no history entry existed for it). Fixed: `howToPlayBtn` pushes a `history` state, a `popstate` listener returns to the title screen in-app; `goToPlay()` cleans the pushed state up via `history.back()` (guarded with `suppressPopstate` so it doesn't re-trigger the same handler).
- `updateBackgroundInert()` now blocks background controls (`camBtn`/`flipBtn`/`bottomBar`) while either screen is shown, same dialog-inert pattern as before.

**Full hand-drawn/sketch restyle (`index.html`, CSS only + one `app.js` manifest color):**
Ham asked how to make the app look less AI-generated; `ui-ux-pro-max` flagged the blurred purple-to-pink glassmorphism dialog gradient as a textbook AI-template tell. Replaced app-wide with a "Sketch Hand-Drawn (Mobile)" treatment:
- New tokens: `--paper-bg` (#FDFBF7), `--ink` (#2D2D2D), `--marker-red`, `--postit-yellow`.
- All dialogs (`#titleScreen`, `#tutorialScreen`, `#retry`, `#camOffScreen`) went from blurred purple/pink gradient + white text to solid paper background + ink text, no `backdrop-filter`.
- Every card/button/pill app-wide (dialog boxes, bottom bar, `#aliveBtn`, `#recordBtn`, `#specialToast`, `#recTimer`, `#idleHint`, `#flipBtn`/`#camBtn`) gained a `3px solid var(--ink)` border, asymmetric wobbly `border-radius`, hard offset shadow (`Npx Npx 0 var(--ink)`, no blur) replacing the old soft drop-shadow recipe, and a couple degrees of fixed rotation (skipped on the circular cam/flip buttons).
- Global `button:active` now shifts the button to visually cover its own shadow (`translate(3px,3px)`, shadow removed) instead of the old scale-down — the "press squishes into the shadow" hand-drawn UI convention.
- Small hand-drawn squiggle SVG added under the `#titleScreen` heading.
- `<meta name="theme-color">` and the PWA manifest's `theme_color` (in `app.js`) updated to the paper tone so OS chrome/installed-icon match.
- Font intentionally kept as Fredoka everywhere (not swapped to Kalam/Patrick Hand) — a full font swap on top of the color/shape overhaul was judged a bigger, unnecessary risk; flagged to Ham as an explicit call he can override.
- Duplicate/near-duplicate raw hex colors that existed before this pass (a red-gradient trio repeated 3x, the retry/title purple-pink gradient stops) were tokenized into `--color-danger-light/-mid/-shadow/-rgb` and `--color-accent-rgb`/`--color-accent-pink-rgb` CSS vars in a separate small cleanup, so future palette changes only need one edit.
- Follow-up polish: title-screen tagline switched from generic `system-ui` to the Fredoka brand font; the "rare creatures" line turned from bare colored text into an actual rotated sticky-note badge (`--postit-yellow` bg, ink border, hard shadow) to match the rest of the sketch language. One em-dash found and removed from the camera-denied dialog copy (`#retryText`) per a `design-taste-frontend` copy audit.
- A hypothetical alternative direction (claymorphism/soft-3D toy UI) was mocked up in a standalone artifact for Ham to look at — he preferred the shipped sketch theme, no change made.

**Not yet verified on Ham's phone:** title screen -> How to Play -> Play flow, back-button behavior on both screens, camera-denied dialog still appearing correctly, and the full sketch restyle across every touched surface (paper bg with no leftover purple/blur anywhere, ink borders/hard shadows visible, buttons visually pressing into their shadow on tap).

## Improvement plan — implemented (2026-07-26)

All four sections of the plan below (see "Agreed improvement plan" further down) are coded and pushed. None of it has been verified on Ham's real phone yet — that's the open item.

- **Core reliability:** `resizeCanvas()` now no-ops unless video dims actually changed (walls rebuild only then, no more per-frame reset). Dropped MediaPipe `camera_utils` entirely — one `getUserMedia` stream feeds `Hands` from the existing render `requestAnimationFrame` loop (`sendFrame()`, guarded against overlapping sends). Physics moved off its own `setInterval` into `stepPhysics()` inside the render loop with a capped accumulator (max 5 steps catch-up), so a backgrounded/hidden tab can't let physics race ahead.
- **First-run UX / a11y:** explicit **Start camera** button (no more click-anywhere). `firstRun`/`retry` are real modal dialogs — `role="dialog" aria-modal="true"`, autofocus their button, and toggle native `inert` on the background controls (`camBtn`/`flipBtn`/`bottomBar`) while open. `camBtn` reflects `aria-pressed`; `flipBtn` disables while camera is off. Bottom bar is now a fixed 4-column grid (no horizontal scroll). Fixed white-on-orange/red contrast failures (danger/primary buttons now use the `-dark` color variants, ~5:1+). Dropped Nunito, system font for supporting copy, Fredoka kept for buttons.
- **Creature delight:** spawn pop is now a 250ms ease-out (was a 700ms elastic overshoot); color ring kept. Removed the experimental procedural smile entirely — eyes only.
- **Recording/sharing:** share payload now includes title/text/URL (`https://chanooooot.github.io/airdoodle/`), with a file-only fallback if a browser rejects the combined share. Added a non-mirrored, crop-safe watermark (`Made with AirDoodle · chanooooot.github.io/airdoodle`) drawn onto the recording composite outside the mirror transform. Real download fallback (temp `<a>` + `revokeObjectURL`) replaces the old dead-end "not supported" message. MediaRecorder-unavailable screenshot fallback now composites camera+drawing instead of the bare transparent overlay.

`node --check app.js` passes; `app.js` is ~31.4KB (as of 2026-07-27), still well under the 50KB budget.

## Design pass + creature variety (2026-07-27)

Implemented a claymorphism visual pass from a Claude Design mock (`AirDoodle Design Pass.dc.html`,
imported via the design MCP), plus a creature-variety feature requested separately. Nothing below has
been verified on Ham's phone yet.

**Visual pass (`index.html`):**
- Chunky gradient buttons everywhere (camBtn/flipBtn, bottom bar, first-run/retry buttons) — thicker
  drop-shadows, gradient fills, replacing the old flat-color look.
- Raw emoji replaced with inline SVG glyphs for camera/flip/alive/record/undo/clear. First-run icon
  chips still use emoji for Fist (✊) and Alive (✨); Pinch went through several iterations (custom PNG
  → hand-drawn SVG attempt, abandoned as unreadable after 3 tries) and is back to native 🤏 — matches
  its siblings, needs no more tuning.
- Recording state: pulsing red frame border + dimmed sibling buttons, both **CSS-only** via `:has()`
  (`#bottomBar:has(#recordBtn.recording) ...`, `body:has(#recordBtn.recording)::after`) — no JS added.
  Modern `:has()` support assumed fine given the project already requires iOS 16.4+ level APIs.
  Added a live elapsed-time pill (`#recTimer`) wired into the existing render loop.
- New **camera-off screen** (`#camOffScreen`): toggling Cam off used to just reveal the plain black
  `<body>` background — replaced with a gradient + icon chip ("Camera off"), matching the
  first-run/retry visual language.
- Retry (camera-denied) screen restyled to match first-run (gradient bg, icon chip, chunky button).

**Creature variety (`app.js`):**
- `COLORS` palette: 6 fixed hex values → 16 generated hues (`Array.from({length:16}, ...)`, even hue
  spread, same saturation/lightness as before) — addresses "creature colors don't vary" feedback.
- `bringAlive()`: ~1-in-10 chance to spawn a **special** creature carrying one of 10 effects picked at
  random — `rainbow` (hue-cycling outline), `sparkle` (drifting gold particles), `glow` (pulsing
  shadowBlur halo), `giant` (1.6x size, radius scaled on the Matter body too so physics matches),
  `shimmer` (sweeping highlight clipped to body), `confetti` (one-shot particle burst at spawn),
  `starryEyes` (star-shaped pupils), `trailGhost` (fading afterimages, needs motion to read), `jellyWobble`
  (bigger breathe/wiggle amplitude, needs motion to read), `orbitRing` (rotating ellipse halo).
- Special creatures get a bigger 3-ring rainbow "firework" birth burst (800ms) instead of the normal
  single-ring pop (450ms), a fading toast pill ("✨ Special creature!"), and a longer haptic buzz — the
  discoverable "tell" that something rare happened.
- All 10 effects were verified rendering distinctly using a temporary `?debug`-gated synthetic
  creature grid (bypasses camera/hand-tracking entirely — this dev environment has no camera). The
  debug code was stripped before the final commit; it is not in shipped `app.js`.
- `trailGhost` and `jellyWobble` specifically could only be confirmed by code review, not screenshot,
  since they only read correctly once the creature is moving/bouncing — worth an explicit look on
  Ham's phone.

## Next steps / open threads

- **Run the motion reliability phone gate before further tuning:** baseline/fixed
  tracking FPS (>=15), 20 pinch cycles, four-stroke smiley, edge-loss grace,
  long-loss disconnect, camera off/on, five creatures, and recording. Use
  ?debug=1; points must not increase faster than MediaPipe results.
- **Nothing above has been tested on Ham's real phone yet.** Priority: verify FPS with 5 creatures (including while recording), Cam off/on, Flip, permission retry, backgrounding/return, and the new dialog/inert behavior doesn't trap focus somewhere unexpected.
- **New from 2026-07-27 session, also unverified on phone:** the claymorphism visual pass (buttons/
  icons/camera-off screen/recording feedback), the 16-color palette, and the bonus special-creature
  system (particularly `trailGhost`/`jellyWobble` motion feel, and whether the ~10% special-spawn rate
  feels right or needs tuning).
- **Creature cap bumped 3 → 5** (Ham's call, explicit perf-risk tradeoff — see updated CLAUDE.md/SPEC.md/BUILD_PLAN.md/AGENTS.md). Unverified whether 5 holds ≥15fps on Ham's phone, especially mid-recording. If it doesn't, drop back toward 3-4.
- LINE and Instagram share testing (text/URL/watermark survival, cancellation quietness, unsupported-share download) — not yet done on Ham's phone.
- No friend/blind test done yet (P5's real verify: "a friend uses it with zero verbal instructions, creates a living creature within 2 minutes"). Do this before considering v1 fully done.
- Judge the removed procedural smile's absence — if eyes alone read as too plain on a real phone, that's a design call for Ham, not a silent re-add.

## Agreed improvement plan (next agent)

### Goal and order

Ship a reliable, understandable v1 first, then use a small delight pass on creature
behavior, interface polish, and sharing. Do not add frameworks, a build step,
analytics, persistence, accounts, sound, or backlog features. Keep the current six
persistent controls: Cam, Flip, Alive, Record, Undo, and Clear.

### Settled decisions for this pass

- **Alive gesture is closed fist held 0.6 seconds.** This is canonical. Fix stale
  open-palm/one-second references in `SPEC.md`, `BUILD_PLAN.md`, `AGENTS.md`,
  `CLAUDE.md`, and code comments.
- The three-file cap means **runtime/public app files only**. Keep project-control
  documents. Add the allowed `README.md` with live URL, gestures, device support,
  privacy note, and real-phone verification status.
- Rename GitHub Pages from `/sage/` to `/airdoodle/` before adding the social CTA.
  Verify the deployed HTTPS URL and document old-link behavior.
- Required sharing targets: **LINE and Instagram** on Ham's phone.
- Share attribution uses both share-sheet text/link and a small recording watermark.

### 1. Core reliability and performance

1. Stop resetting `canvas.width` and `canvas.height` every animation frame. Resize only
   when dimensions change; rebuild Matter walls only then. Preserve mirrored alignment.
2. Give camera ownership to one path. Remove MediaPipe `camera_utils` and feed the
   existing `getUserMedia` stream into Hands from one sequential animation loop. Cam,
   Flip, retry, and return-from-share must use that one lifecycle.
3. Move Matter's fixed 30 Hz update into the render loop with a capped time accumulator.
   Remove the independent physics `setInterval`; hidden tabs must not race physics ahead.
4. Keep the one-hand lite model, 3-creature cap, circle bodies, and 2,000-point limit.
   Do not add speculative optimization: profile on Ham's phone first.
5. Keep `app.js` below 50 KB. Run `node --check app.js` after changes and retain
   `?debug=1` FPS diagnostics.

### 2. First-run UX, controls, and accessibility

1. Replace click-anywhere onboarding with an explicit **Start camera** button. Use:
   “Prop up your phone. Pinch thumb + index finger to draw. Hold a fist to bring it alive.”
2. Give first-run and camera-denied surfaces dialog semantics, keyboard access, visible
   focus, and a stacking level above all controls. They must block background controls.
3. Keep all six controls. Update the camera label and `aria-pressed` with its state;
   disable Flip while the camera is off.
4. Make Alive, Record, Undo, and Clear a fixed four-column bottom toolbar instead of a
   horizontally scrolling row. Preserve 44 x 44 px targets and safe-area padding.
5. Fix white-on-orange/red contrast. Keep violet for Alive. Retain Fredoka for playful
   controls, use the system font for supporting copy, and remove the Nunito request.

### 3. Creature delight pass

1. Replace the 700 ms elastic spawn with a 200-300 ms ease-out pop; retain the color ring.
2. Remove the experimental procedural smile for v1. It is outside the settled behavior
   spec and can distort abstract drawings; eyes are sufficient personality.
3. Tune only existing behavior: spawn readability, collision-startle duration, hop force
   and timing, eye placement, blink cadence, and pupil tracking. Do not add limbs, sound,
   particles, or new creature modes.
4. Limit delight tuning to two real-phone rounds. If Ham does not approve it, honor the
   existing P3 kill gate.

### 4. Recording and social sharing

1. Share the recorded file plus:
   - Title: `AirDoodle`
   - Text: `I drew this in the air and brought it to life ✨ Make yours:`
   - URL: `https://chanooooot.github.io/airdoodle/`
2. After the mirrored recording composite, draw a small readable **non-mirrored** watermark:
   `Made with AirDoodle · chanooooot.github.io/airdoodle`. Keep it in crop-safe margins.
   The watermark is attribution; the share URL is the clickable route back to the app.
3. Some social apps may discard share text/URLs with a video. Test LINE and Instagram
   separately; the watermark is the reliable fallback.
4. Implement the promised fallback: create/click a temporary download link, then revoke
   its object URL. Do not only show “Save not supported”.
5. When MediaRecorder is unavailable, screenshot the camera + drawing composite, not the
   transparent drawing overlay alone.
6. Keep the 15-second cap and plain Record/Stop labels; do not restore a live countdown.

### Verification checklist

- `node --check app.js` passes; own JS remains below 50 KB.
- Ham's phone sustains at least 15 FPS with three creatures, including while recording.
  Test orientation, Cam off/on, Flip, permission retry, backgrounding, and share return.
- Physics stays at fixed 30 Hz and does not advance while the tab is hidden.
- Controls stay visible without horizontal scrolling, meet 44 px minimums, expose focus,
  and pass AA text contrast.
- Blind test: a fresh user starts camera, draws, brings a creature alive, and records/
  shares it within two minutes without verbal help.
- Delight test: Ham approves the alive moment within two tuning rounds.
- LINE and Instagram: video plays, watermark is readable/unmirrored, CTA survives where
  supported, cancellation is quiet, and unsupported sharing downloads a usable file.
- Verify `https://chanooooot.github.io/airdoodle/` over HTTPS after the Pages rename.
  Update the cache-busting query whenever `app.js` changes.
