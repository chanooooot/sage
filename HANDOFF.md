# HANDOFF — AirDoodle

**Last updated:** 2026-07-22 (desktop playability fix)
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
