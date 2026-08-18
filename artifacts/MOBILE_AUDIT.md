# DS4 Solar System — Mobile Layout Audit & Planet-Sizing Fix

Status: **AUDIT COMPLETE** — every required viewport measured in a real Chromium
browser (Playwright + SwiftShader), failures reproduced with concrete numbers
and screenshots, and the oversized-body defect fixed and verified before/after.
Task `t_3d8bd524`.

Baseline Git
- Branch: `main` · HEAD before work: `0ac917a9773c7ba25f6f2933b775a75131f20e45` (clean)
- Working tree clean at start; changes committed below.

Environment
- Host: macOS (Darwin 26.6), Node v26.7.0
- Browser: Playwright Chromium v1234 (headless, `--use-gl=angle
  --use-angle=swiftshader --enable-unsafe-swiftshader`), real viewport emulation
- Served by Vite `npm run dev` (localhost; see harness BASE_URL override)
- Repo root: <project-root>

Checks
- `npm run typecheck` → PASS · `npm run test` → 80/80 PASS · `npm run build` → PASS

Reproducible harness: `artifacts/evidence/mobile-audit/harness.mjs`
`node artifacts/evidence/mobile-audit/harness.mjs <out-dir> <label>`
- Automated four viewports with mobile/desktop emulation, printed every
  viewport/document/canvas measurement, UI bounding boxes, console/page/network
  errors, and screenshots (home + a populated-info state).

---

## 1. Rapid results table (all four required viewports)

| Viewport | Doc not scrollable | Canvas fills viewport | Renderer DPR ≤ 2 | Info ⨯ control-bar (populated) | Hit targets ≥44px | Console/page errors |
|---|---|---|---|---|---|---|
| 360×800  (portrait) | PASS | PASS | PASS | **FAIL (overlap)** | FAIL (32px) | 0
| 390×844  (portrait) | PASS | PASS | PASS | **FAIL (overlap)** | FAIL (32px) | 0
| 844×390  (landscape) | PASS | PASS | PASS | **FAIL (overlap)** | FAIL (32px) | 0
| 1280×800 (desktop)   | PASS | PASS | PASS | PASS | FAIL (32px, minor on desktop) | 0

(the "HUD header does not overlap info panel" flag in the harness JSON is a
harness-heuristic false positive — HUD is top-LEFT and info panel top-RIGHT /
bottom; their bounding boxes never coincide. Raw rects confirm no real overlap.)

---

## 2. Viewport-by-viewport observations

### 360×800 (portrait) — partial FAIL
- Document/scroll: `overflow:hidden` on html & body; `docScrollW/H == 360/800`;
  no scroll — PASS. No scrollbar/overscroll.
- Canvas fills viewport (client 360×800), renderer buffer 720×1600 →
  effective DPR 2 (capped) — PASS. `touch-action:none` everywhere (OrbitControls).
- HUD top-left (x12–184, y10–66), 17px title — on-screen, no overlap — PASS.
- **FAIL — info panel overlaps the wrapped control bar.** Control bar wraps to a
  tall multi-row bar (176px high, y614–790) because the media query assumes a
  single 52px row (`--control-h:52px`) but at ~360px width the groups wrap.
  The info panel's CSS bottom is `calc(var(--control-h) + 76px)` = 128px from
  the bottom → its bottom edge (y672) sits **above/past the control bar's top
  (y614)** by ~58px in the empty state; with a body selected the populated panel
  spans y434–672 and the control bar (top 614) covers its lower ~58px. Because
  the control bar has higher z-index (6 vs 4), it draws over the panel's lower
  content. Repro: select any planet → its desc/rows are partially occluded by
  the toolbar.
- Control hit targets: buttons are 32px tall; icon buttons 34×32, 홈 37×32,
  select 32px tall — under the 44/48px touch guideline. Widths are mostly OK
  but height is uniformly 32px. Touch usability risk.
- Fonts: HUD 17px, ctrl 13px — small but legible; info scrolls internally.

### 390×844 (portrait) — partial FAIL
- Everything above repeats. Control bar wraps to a tall bar at y700–834; info
  panel bottom (empty) y716 ≥ control-bar top y700 → overlap in the empty state
  too; populated panel y478–716 overlaps control bar top y700 by 16px.
- Same hit-target and 32px-height findings.

### 844×390 (narrow landscape) — partial FAIL
- Wide (>760px) so the DESKTOP rules apply (info pinned top-right x524–824
  y78–152; HUD top-left). Control bar still wraps to a 134px two-row bar
  centered x211–633 y238–372.
- Empty state: no overlap (info y78–152 clear). **FAIL on populate:** selected
  body grows the info panel to y268, past control-bar top 238 → 30px overlap;
  the bottom info row is half-hidden behind the toolbar. Keyboard-hint
  (bottom-left) is partially occluded by the centered control bar here too.
- 390px height is tight; the two-row control bar consumes ~134px of it.

### 1280×800 (desktop) — PASS (behavior preserved)
- All three chrome regions positioned correctly, no inter-panel overlap.
  Control bar single row (y690–782). Info top-right, HUD top-left.
- Minor: bottom-left keyboard hint is partially occluded where it passes under
  the centered control bar (pre-existing, cosmetic); bodies no longer collide
  with the toolbar after the sizing fix.
- This is the preserved-behavior baseline: layout unchanged, still correct.

---

## 3. Planet sizing — fix and before/after evidence (operator-added requirement)

### Root-cause audit
`ScaleManager.radius()` (log mode) mapped

```
sceneRadius = clamp( sunSceneRadius · log1p(km)/log1p(696340) , min, max )
```

with `sunSceneRadius = 5.0`, `minSceneRadius = 0.25`, `maxSceneRadius = 10.0`.
Because `log1p` of the whole 11 km → 696 340 km range compresses into a narrow
band around 1, every planet/probe landed on the upper 50–83% of the Sun's size:

| body | real radius km | scene radius (before) | % of Sun | planet/orbit-ratio |
|---|---|---|---|---|
| sun | 696340 | 5.000 | 100% | 0 (anchor) |
| jupiter | 69911 | 4.146 | 83% | 0.213 |
| saturn+rings | 58232 | 4.078 (+rings ~×1.6) | 82% | 0.196 |
| neptune | 24622 | 3.758 | 75% | 0.162 |
| uranus | 25362 | 3.769 | 75% | 0.169 |
| earth | 6371 | 3.256 | 65% | 0.205 |
| venus | 6051 | 3.236 | 65% | 0.213 |
| mars | 3389 | 3.021 | 60% | 0.180 |
| mercury | 2439 | 2.899 | 58% | 0.210 |
| moon | 1737 | 2.773 | 55% | 0.809 |

So on screen the Sun was only ~1.2–1.7× a planet's diameter; Jupiter/Saturn
were nearly Sun-sized, and bodies were ~20% of their own orbital radius —
diameter ≈ half the gap to the neighbour orbit. Visual proof is in the
`*/…-home.png` screenshots: bodies span many orbit tracks, overlap each other,
Sun≈170px vs Earth≈120px on desktop, planets edge-to-edge on mobile.

### Fix (committed, `src/core/ScaleManager.ts`)
Two focused changes, keeping the mapping pure/monotonic:
1. Lower the Sun anchor `sunSceneRadius` 5.0 → **2.2**.
2. Add a `radiusCompression` exponent (default **3.0**) applied to the
   in-[0,1] log-normalized ratio:

```
sceneRadius = clamp( sunSceneRadius · (log1p(km)/log1p(696340))^compression , min, max )
```

Since every body except the Sun has ratio < 1, raising it to the 3rd power
shrinks them disproportionately — planets drop toward the Sun, the Sun stays
dominant, and ordering (strictly monotonic in real radius) is preserved.

| body | scene radius after | % of Sun | planet/orbit-ratio |
|---|---|---|---|
| sun | 2.200 | 100% | 0 |
| jupiter | 1.254 | 57% | 0.064 |
| saturn+rings | 1.193 (+rings ~×1.6) | 54% | 0.057 |
| uranus | 0.942 | 43% | 0.042 |
| neptune | 0.934 | 42% | 0.040 |
| earth | 0.607 | 28% | 0.038 |
| venus | 0.597 | 27% | 0.039 |
| mars | 0.485 | 22% | 0.029 |
| mercury | 0.429 | 19% | 0.031 |
| moon | 0.375 | 17% | 0.110 |
| pluto | 0.321 | 15% | 0.013 |

Resulting Sun : Jupiter : Earth ≈ 3.2 : 2.2 : 1.0; every planet is now a clear
sub-dominant marker on its orbit (planet/orbit ratios drop ~3–5× to 0.03–0.06).
Minimum visibility preserved: tiny moons (phobos, deimos, styx, nix, …) clamp
to the 0.25 scene floor and remain visible points; planets all stay above the
floor. `radiusCompression` is configurable, so the next worker can tune it
without a redesign.

### Before/after screen evidence (Live, real rendering)
| Viewport | BEFORE | AFTER |
|---|---|---|
| 360×800 home | before/360x800-home.png | after/360x800-home.png |
| 360×800 populated (Earth) | before/360x800-focused-earth.png | after/360x800-focused-earth.png |
| 390×844 home | before/390x844-home.png | after/390x844-home.png |
| 844×390 home | before/844x390-home.png | after/844x390-home.png |
| 844×390 populated | before/844x390-focused-earth.png | after/844x390-focused-earth.png |
| 1280×800 home | before/1280x800-home.png | after/1280x800-home.png |
| 1280×800 populated | before/1280x800-focused-earth.png | after/1280x800-focused-earth.png |

Per-viewport `metrics.json` (before/ + after/) hold every DOM/canvas/DViewport
measurement and the pass/fail breakdown.

### Verification of the fix
- `npm run typecheck` PASS; `npm run test` 80/80 (added 2 tests locking in:
  "Sun dominant & planets sub-dominant", "tiny-moon floor visibility");
  `npm run build` PASS.
- Live screenshots confirm the reduction at mobile AND desktop (this is the
  operator's requested verification).

---

## 4. Recommended focused fixes for the next worker (NOT speculative — awaiting a follow-up card)

These were found by the audit but intentionally NOT changed here (this card's
scope was: audit + the planet-sizing fix). Each is small and localized:

1. **Info-panel ⨯ control-bar overlap (highest priority).**
   Root cause: `.info-panel` mobile `bottom: calc(var(--control-h) + 76px)`
   assumes a single 52px control-row, but the control bar wraps to 2+ rows on
   narrow widths (176px at 360w, 134px at 390w/844w), so its top rises into the
   panel. Focused fix options:
   - Increase the mobile clearance (`bottom: calc(var(--control-h) * 3 + 76px)`
     or a larger fixed offset), measured against the wrapped control-bar height;
     or
   - compute it from the live control-bar rect via a small ResizeObserver in
     AppController and set `info-panel.style.bottom` dynamically.
   Verify by re-running the harness (fail → pass for "info panel does not
   overlap control bar" on all three mobile viewports).

2. **Control-bar vertical footprint on mobile.**
   At 360px width the bar is 176px (4 visual rows) — it consumes ~22% of the
   viewport. Recommend consolidating controls (or letting the mobile bar scroll
   horizontally as a single row on one/two lines). Keep hit targets ≥44px.

3. **Control hit-target height (all viewports, incl. desktop).**
   Buttons are 32px tall; icon buttons 34×32, 홈 37×32. Bump mobile `.ctrl-btn`
   height to 44px (and widen the 34px icon buttons) for touch ergonomics.

4. **Label collisions (mobile + cluttered desktop clusters).**
   Visual evidence: moon labels overlap around Saturn and in the upper-left
   cluster; some labels clip at edges / hide behind the bottom panel. Suggest
   label decluttering nearest-neighbour repulsion or hide-on-collision — out of
   scope here.

5. **Safe-area inset handling absent.**
   `env(safe-area-inset-*)` is not consulted anywhere (all `safeArea` values
   blank in metrics). On notched phones the fixed bottom toolbar and HUD could
   sit under the home indicator / notch. Add `padding: env(...)` to
   `.control-bar`/`.hud-header`/`.info-panel` and use `100dvh` (dynamic
   viewport height) instead of `100%` for the canvas container so mobile
   browser-chrome shrink is respected. (Mobile Safari URL-bar shrink is the
   main risk here.)

Each of these is independent and reproducible via the committed harness.

---

## 5. Durable evidence locations (all committed under `artifacts/evidence/mobile-audit/`)
- `harness.mjs` — the reproducible driver (before/after)
- `before/*.png`, `before/metrics.json` — pre-fix screenshots + full measurements
- `after/*.png`, `after/metrics.json` — post-fix screenshots + full measurements
- This file is the synthesised, human-readable audit.

Git:
- Commit 1 (fix): `ScaleManager` planet-sizing (code + 2 tests + README).
- Commit 2 (audit): the `artifacts/evidence/mobile-audit/` evidence + this doc.
