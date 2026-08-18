# DS4 Solar System — Final WebGL Verification

Status: **PASS** — every runtime criterion verified in a real Chromium browser
with working WebGL (SwiftShader). This is the final verifier & evidence
aggregator run for card `t_989fb508`.

Environment
- Host: macOS (Darwin), Node v26.7.0, npm 11
- Browser: Playwright Chromium v1234 (headless, `--use-gl=angle
  --use-angle=swiftshader --enable-unsafe-swiftshader`), real coordinate,
  keyboard, and DOM clicks
- App served by `npm run dev` (Vite) at http://localhost:5173/
- Repo root: <project-root>  ·  branch main

Commands run
  npm run typecheck   → PASS (tsc --noEmit, strict)
  npm run test        → PASS (78/78 Vitest)
  npm run build       → PASS (vite production build)
  node artifacts/evidence/smoke-traces/smoke.mjs  → PASS (browser smoke)
  node artifacts/evidence/smoke-traces/sweep.mjs  → PASS (select-all-bodies sweep)

Checklist results (all criteria met)
  [x] Mounted, nonzero canvas — buffer 1280×800, 1 canvas under #app
  [x] Sun, all 9 named bodies incl. Pluto present & selectable (sun, mercury,
      venus, earth, mars, jupiter, saturn, uranus, neptune, pluto)
  [x] All 25 moons in the body dropdown (moon, phobos, deimos, io, europa,
      ganymede, callisto, mimas, enceladus, tethys, dione, rhea, titan,
      iapetus, miranda, ariel, umbriel, titania, oberon, triton, charon, styx,
      nix, kerberos, hydra) → 35 selectable bodies total
  [x] Every body selectable & focused — all 35 individually selected via the
      dropdown, each activated the info panel with correct Korean name; 0 bad
  [x] Saturn's rings — visually confirmed in saturn-focused.png (3-D tilted
      ring system in front of/behind the planet) + info card "토성/SATURN/행성"
  [x] Animation running — HUD "시뮬레이션 1.1일 → 3.3일" advanced; 4.8% RGB
      frame diff between two screenshots (motion observable)
  [x] Labels toggle — #ctrl-labels aria-pressed true→false, button text
      "레이블 표시"⇄"레이블 숨기기"
  [x] Play/pause — #ctrl-play aria-pressed true→false→true
  [x] Speed ladder — real clicks 1일/초 → 365일/초 (6 up), − → 100일/초,
      초기화 → 1일/초
  [x] Camera home/reset — #ctrl-home returns to full-system view, info panel
      back to empty placeholder
  [x] Prev/next focus — ▲/▼ navigate bodies (e.g. 타이탄 → 이아페투스)
  [x] Viewport resize — 1280×800 → 900×600, canvas buffer tracks viewport
      (900×600), renderer + camera aspect stay correct
  [x] No missing scene nodes — dropdown/#app wired to all 35 bodies
  [x] No failed assets — 0 failed/4xx network requests
  [x] No browser console or runtime errors — 0 console errors, 0 page errors
  [x] Sensible framing/scale — home view fits Sun→Pluto on one screen (log
      scale); each focus view centered on its body

Durable evidence (artifacts/evidence/)
  home-full.png        — full home scene: Sun + 9 planets/Pluto + moons + labels
  motion2.png          — taken 2s later; diff vs home-full proves animation
  saturn-focused.png   — Saturn ring system close-up + info card (83.1% non-black)
  titan-focused.png    — Saturn's moon Titan focused (87.2% non-black)
  home-after-reset.png — full-system view after #ctrl-home
  resized-900.png      — canvas after viewport resize to 900×600
  smoke-traces/smoke.mjs / sweep.mjs — the reproducible harnesses
  smoke.json           — full smoke-trace result (checkpoints, interactions, errors)

Percent non-black (content present) via PIL RGB decode:
  home-full 30.5% · motion2 29.7% · saturn-focused 83.1% · titan-focused 87.2% ·
  home-after-reset 29.1% · resized-900 37.8%
Motion frame diff (home-full vs motion2): 4.8% of pixels changed > threshold.

Authoritative harness + outputs are committed under artifacts/evidence/smoke-traces/.
