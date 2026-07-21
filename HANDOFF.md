# HANDOFF — AirToon

**Last updated:** 2026-07-22
**Live URL:** https://chanooooot.github.io/sage/ (repo: chanooooot/sage, public)

## Status: P0–P5 all shipped, in polish/iteration

All phases from BUILD_PLAN.md are built and deployed. Currently doing post-launch refinement based on Ham's real-device testing.

## What's built

- **P0** Camera skeleton, mirrored full-screen, permission-denied retry screen
- **P1** MediaPipe hand tracking (1 hand, lite model), fingertip/palm tracking, FPS counter (`?debug=1`)
- **P2** Pinch-to-draw (hysteresis + 3-vote smoothing), multi-stroke, Undo (removes last stroke), Clear
- **P3** matter.js physics — creatures spawn at drawn position (not falling), circle body, breathe/wiggle/blink/hop, hand-body collisions with startle reaction, cap 3 creatures w/ 1.5s fade-out oldest
- **P4** 15s recording (camera+canvas composite via MediaRecorder), Web Share API w/ download fallback, screenshot fallback if MediaRecorder unsupported
- **P5** First-run instruction overlay (shown before camera opens, camera starts on tap), flex bottom bar w/ safe-area insets, friendlier camera-denied copy
- **Extra (post-launch):** front/back camera flip toggle (🔄, mirror auto-disables on back camera), birth effect (expanding color ring + elastic wobble pop-in), UI beautification pass (Fredoka/Nunito fonts, claymorphism-lite buttons, haptic feedback on Alive/Record, pulsing record button)

## Deviations from original SPEC.md

- **D6 changed:** "Alive" trigger is now **closed fist** (not open palm) — open palm false-triggered during pinch/draw since relaxed fingers read as extended. Hold time also tuned 1s → 0.6s for responsiveness. SPEC.md decision log already updated to reflect this.
- Hand collision hitboxes widened (fingertip 14→26px, palm 30→45px radius) to reduce tunneling on fast hand-bat motions and make index-finger poking easier to land — not in original spec, added for feel.

## Known issues / accepted limitations

- Hand tracking drops fully when hand exits camera FOV (e.g. drawing near screen edges) — normal MediaPipe limitation, accepted, not fixed. Documented as a constraint, not a bug.
- iOS Safari MediaRecorder — timeboxed test was done, confirmed working via user testing (if this regresses, screenshot fallback already in place, see `app.js` `startRecording()`).

## Cache-busting note

`index.html` loads `app.js?v=N` — **bump the version number every time app.js changes** or GitHub Pages/mobile Safari caching will serve stale JS during testing. Currently at v19.

## Next steps / open threads

- No friend/blind test done yet (P5's real verify: "a friend uses it with zero verbal instructions, creates a living creature within 2 minutes"). Do this before considering v1 fully done.
- User was mid-way through a UI beautification pass (ui-ux-pro-max skill guided) — check how it looks on a real phone; may want another pass.
- Consider whether Undo/Clear/Alive/Record/Flip (5 controls total) is getting cluttered — watch for this in the blind test.
