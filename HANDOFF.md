# HANDOFF — AirDoodle

**Last updated:** 2026-07-26 (ship-ready + delight improvement plan added)
**Live URL:** https://chanooooot.github.io/sage/ (repo: chanooooot/sage, public)
**App name:** AirDoodle (renamed from AirToon — title, share sheet, filenames, all docs updated)

## Status: P0–P5 all shipped, plus a full review/polish pass

All phases from BUILD_PLAN.md are built and deployed. Did a full code/UX/design review
pass (plan: see git log around commits `033117b`..`8d234d4`; review plan file if still
present locally: `C:\Users\chano\.claude\plans\atomic-watching-dewdrop.md`), then a
rename + home-screen-icon pass on top.

## What's built

- **P0** Camera skeleton, mirrored full-screen, permission-denied retry screen
- **P1** MediaPipe hand tracking (1 hand, lite model), fingertip/palm tracking, FPS counter (`?debug=1`)
- **P2** Pinch-to-draw (hysteresis + 3-vote smoothing), multi-stroke, Undo (removes last stroke), Clear, stroke points capped at 2000 (drop-oldest, perf budget)
- **P3** matter.js physics — creatures spawn at drawn position (not falling), circle body, breathe/wiggle/blink/hop, hand-body collisions with startle reaction, cap 3 creatures w/ 1.5s fade-out oldest
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

- Hand tracking drops fully when hand exits camera FOV (e.g. drawing near screen edges) — normal MediaPipe limitation, accepted, not fixed. Documented as a constraint, not a bug.
- iOS Safari MediaRecorder — timeboxed test was done, confirmed working via user testing (if this regresses, screenshot fallback already in place, see `app.js` `startRecording()`).
- Procedural smile (Tier 3.2 of the review) is explicitly experimental — it's live but not battle-tested on a wide variety of drawings. May look odd on abstract scribbles; watch for this and remove `app.js`'s "experimental: procedural smile" block if it doesn't read well.

## Cache-busting note

`index.html` loads `app.js?v=N` — **bump the version number every time app.js changes** or GitHub Pages/mobile Safari caching will serve stale JS during testing. Currently at v31.

## Next steps / open threads

- No friend/blind test done yet (P5's real verify: "a friend uses it with zero verbal instructions, creates a living creature within 2 minutes"). Do this before considering v1 fully done.
- Judge the experimental procedural smile on a real phone with real drawings — keep or cut.
- Bottom bar now has Alive/Record/Undo/Clear (4 buttons, one row, scrolls if needed) plus top-right Cam/Flip toggles (6 controls total) — watch for clutter in the blind test.

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