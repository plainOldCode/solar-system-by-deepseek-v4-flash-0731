# Integration Verification — t_62eaf897

Repo (only): <project-root> (branch main)
Integrated commits (in order):
- 599e06d  fix: make default orbital view horizontal and plane-like
- 6233929  feat: accessible global Hide/Show Panels control for the HUD
- 6217e6d  feat: reduce default simulation rate to one tenth (0.1 days/sec)

All three were already merged onto main; this task verified them as one integrated build.

## 1) Static checks (exit codes)
- npm run typecheck -> exit 0
- npm run test        -> 91/91 tests pass, exit 0  (6 files)
- npm run build       -> vite build success, exit 0

## 2) Live browser/WebGL smoke test
Harness: artifacts/evidence/integration/integration.mjs (Playwright, headless Chromium/SwiftShader)
Server:  npm run preview on port 5177 (curl / -> HTTP 200), built from HEAD.
Viewports: desktop 1280x800, mobile portrait 390x844, mobile landscape 844x390.
Result: 24/24 automated checks pass; 0 console errors, 0 pageerrors, 0 failed requests.

### Verified behaviors
- Initial system is horizontal and plane-like: vision-confirmed broad horizontal disc of
  orbit rings around central Sun (not vertical/edge-on). Desktop band width:height = 1.37,
  lit px 6057. Mobile portrait verified visually as horizontal disc (near-edge-on oblique view).
- 3D OrbitControls: mouse drag rotates the camera view (rendered spread changes 1.37 -> 1.72,
  ratio/lit change); vision confirms a valid rotated 3D oblique view, plane intact, no corruption.
- Inclined orbits remain visible: vision confirms Pluto's inclined orbit tilts out of the main
  plane; info shows axial tilt 122.5°. Bodies render in 3D with perspective foreshortening.
- Body selection/focus correct: selecting Jupiter fills info panel (목성/행성), Pluto (명왕성);
  focus state + info survive hide/show round-trip; home shows empty info with full 35-body list.
- Hide Panels removes intended HUD and labels: #app.hud-hidden folds header, info-panel,
  control-bar, kb-hint (all display:none); vision confirms all in-scene Korean labels removed,
  only persistent "☰ 패널 표시" button remains.
- Persistent Show Panels is keyboard accessible and restores everything: focused element
  #show-panels, Enter restores full HUD, aria-pressed back to true, selection/focus preserved.
  Tested on all three viewports.
- Default orbital/date progression is one tenth: default speed 0.1일/초; date advances
  Δ 0.50일 over 5s (one tenth of former 1 day/sec). Speed ladder 0.1->0.2->0.5->1->3->10->36.5
  ->100->365->1000 all coherent, reset returns speed 0.1 and date ~0, speed-down disabled at floor.
  Relative orbital-period ratios unchanged (shared time level, no per-body tuning).
- No WebGL/console/page errors at any viewport; WebGL2 context OK (vendor/renderer/version reported).

## 3) Screenshots (artifacts/evidence/integration/)
desktop-home.png, desktop-after-drag.png, desktop-jupiter.png, desktop-pluto-inclined.png,
desktop-hidden.png, desktop-restored.png, mobile-390x844-home.png, mobile-390x844-restored.png,
mobile-844x390-home.png, mobile-844x390-restored.png; plus metrics.json (machine-readable).

## 4) Integration/fix commit
None required — the three feature commits integrate cleanly; no app source fix was needed.
Added only this evidence directory as a focused commit so Git status is clean.

Clean git status confirmed at the end.
