# DS4 Solar System — Final Verification Manifest

Status: **VERIFIED** — final verifier run for card `t_3a09a8a4`, executed
independently against the committed implementation state (HEAD `be2ea97`),
aggregating the mobile-layout audit + focused-fix work and the operator-added
planet-sizing requirement, with fresh end-to-end browser evidence.

Scope note: this repo only. `solar-system-demo` was not accessed. This task
reviews/aggregates prior work rather than rewriting the app; only the final
evidence below was added.

## Implementation under verification (committed hashes)

| Commit | What it is |
|---|---|
| `1d471ef` | Planet-sizing fix: `ScaleManager` `sunSceneRadius` 5.0→2.2 + `radiusCompression` 3.0 (Sun:Jupiter:Earth ≈ 3.2:2.2:1.0) + 2 tests + README |
| `d06be71` | Mobile-layout audit + planet-sizing before/after evidence (harness + 16 screenshots + metrics) |
| `717b286` | Mobile layout/interaction fixes: info-panel ClearOfBar (ResizeObserver), single 62px scrollable control row, ≥44px touch targets, safe-area insets + 100dvh |
| `be2ea97` | Mobile-fix verification evidence at 4 viewports |
| ← HEAD | starting point of this final-verification run |

## Environment

- Host: macOS (Darwin 26.6), Node v26.7.0, npm 11
- Browser: Playwright Chromium (headless, `--use-gl=angle --use-angle=swiftshader
  --enable-unsafe-swiftshader`) — real WebGL via SwiftShader
- App served by Vite `npm run dev` at http://localhost:5173/
- Repo root: <project-root> · branch `main` · HEAD `be2ea97e3b0ea17aad52ff8988bc2d4069c65315`

## Commands + outputs

    npm run typecheck  → PASS (tsc --noEmit, strict)
    npm run test       → PASS — 80/80 Vitest (4 files), 225ms
    npm run build      → PASS — vite production build, dist/assets ok (532 kB JS / 135 kB gzip)
    node harness.mjs artifacts/evidence/final-verification/after-fix final → PASS, exit 0
    node orientation.mjs .../orientation → PASS, exit 0

Independent browser run reused the project's reproducible harness and a new
supplemental orientation/resize harness (`artifacts/evidence/final-verification/orientation.mjs`).

## Viewport measurements (fresh independent run, committed state)

| Viewport | Canvas client / buffer | Renderer DPR | doc scroll (no overflow) | info-panel vs control-bar | populated(Earth) overlap | console/page errors |
|---|---|---|---|---|---|---|
| 360×800  | 360×800 / 720×1600 | 2.00 | 360×800, hidden | info y642–716 < bar y728–790, no overlap | ok | 0 |
| 390×844  | 390×844 / 780×1688 | 2.00 | 390×844, hidden | info y686–760 < bar y772–834, no overlap | ok | 0 |
| 844×390  | 844×390 / 1688×780 | 2.00 | 844×390, hidden | info y232–306 < bar y318–380, no overlap | ok | 0 |
| 1280×800 | 1280×800 / 1280×800 | 1.00 | 1280×800, hidden | info y78–152 < bar y690–782, no overlap | ok | 0 |

Every layout-critical harness check passes on all 4 viewports: document
non-scrollable, canvas fills viewport, renderer caps DPR at 2, HUD header /
info panel / control bar all on-screen, info panel does not overlap control
bar, info panel within viewport, touch gesture probe ok on mobile, focused
(Earth) populated state overlap = ok.

The two remaining harness flags are documented artifacts of the harness itself:

1. `HUD header does not overlap info panel` flags on every viewport — a known
   *heuristic false positive* (documented in both MOBILE_AUDIT and MOBILE_FIX):
   the HUD is top-LEFT (x12–184, y10–66) and the info panel is top-right /
   bottom; their rectangles never coincide on screen. Raw rects confirm no
   real overlap.
2. Desktop `small hit targets` (32px) — *intentional and preserved*: desktop
   controls were deliberately left at their pre-existing 32px to keep the
   desktop baseline pixel-identical. Mouse input only; Apple/Android 44×44
   guidance applies to touch (mobile), where all targets are ≥44×44.
   Desktop tuples measured: ctrl-play 83×32, speed ± 34×32, reset 60×32,
   labels 111×32, focus ± 34×32, body-select 168×32, home 37×32.
3. Desktop `touchGesture: error` — harness quirk: `touchscreen.tap` is used on
   the desktop context which has `hasTouch:false`. Not an app defect (0 console
   errors; desktop is exercised via mouse). Mobile contexts gesture probe = ok.

Mobile touch targets (≥44×44): ctrl-play 87×44, speed± 44×44, reset 64×44,
labels 115×44, focus± 44×44, body-select 130×44, home 44×44.

## Orientation / resize / motion (supplemental harness)

- Orientation 360×800 (portrait) → 844×390 (landscape): canvas client/buffer
  track to 844×390 / 1688×780, doc not scrollable (844×390), info bottom 306 <
  control-bar top 318 → no overlap after orientation change.
- Desktop resize 1280×800 → 900×600: canvas buffer tracks 900×600, camera
  aspect 1.6 → 1.5, no overlap (info 151.6 < bar 448), no scroll.
- Animation/motion: HUD simulation clock advanced 1.6일 → 3.8일 across a ~2.2s
  window → render loop live (frame diff also in screenshots).
- Camera aspect/framing: aspect = clientW/clientH at every viewport; focus views
  center their body (Earth-focused screenshot centered).

## Planet sizing — operator-added requirement (aggregated evidence)

Requirement: planets were far too large; audit ScaleManager radius mapping,
min/max scene radius, Sun-vs-planet sizing, camera framing, mobile apparent
size; preserve ordering + minimum visibility; record before/after; commit.

Root cause (commit `1d471ef`): prior `sunSceneRadius=5.0` + log mapping had
every planet/probe land on the upper 50–83 % of the Sun's size and ~20 % of its
own orbit radius — Sun was only ~1.2–1.7× a planet's diameter and Jupiter/Saturn
were nearly Sun-sized. Fix (per the audit's before/after table):

| body | scene radius before | % Sun (before) | scene radius after | % Sun (after) | planet/orbit-ratio after |
|---|---|---|---|---|---|
| sun    | 5.000 | 100% | 2.200 | 100% | 0 (anchor) |
| jupiter| 4.146 | 83%  | 1.254 | 57%  | 0.064 |
| earth  | 3.256 | 65%  | 0.607 | 28%  | 0.038 |
| pluto  | (tiny) | —    | (floor 0.25) | —    | tiny-moon floor |

Result: Sun : Jupiter : Earth ≈ 3.2 : 2.2 : 1.0; bodies read as sub-dominant
orbs well inside their orbit rings; real-radius ordering strictly preserved
(monotonic); tiny moons stay visible via the 0.25 floor. 2 new unit tests lock
this in; `radiusCompression` remains configurable.

Sizing verified independently here: fresh desktop-home screenshot shows the Sun
clearly dominant in scale with planets reasonably sized and not overlapping
their orbits; Earth-focused mobile view shows Earth sized appropriately. (Note:
the Sun renders dark-olive — a pre-existing stylistic color choice, not a
sizing defect.)

## Screenshots (evidence)

- artifacts/evidence/final-verification/after-fix/360x800-home.png, 360x800-focused-earth.png
- artifacts/evidence/final-verification/after-fix/390x844-home.png
- artifacts/evidence/final-verification/after-fix/844x390-home.png, 844x390-focused-earth.png
- artifacts/evidence/final-verification/after-fix/1280x800-home.png, 1280x800-focused-earth.png
- artifacts/evidence/final-verification/orientation/orientation-landscape.png, resize-1280x800-to-900x600.png, motion-t0.png, motion-t1.png
- Prior before/after planet-sizing + mobile-fix evidence under artifacts/evidence/mobile-audit/{before,after}/ and artifacts/evidence/mobile-fix-v2/after-fix/

## Console evidence

0 console errors, 0 page errors, 0 HTTP ≥400, 0 failed requests on all four
viewports (base harness) and on the orientation/resize/motion harness.

## Known limitations (precise, non-blocking)

- Desktop controls intentionally kept 32px (preserved baseline); not intended
  for touch. Mobile controls ≥44×44.
- `.kb-hint` (desktop bottom-left shortcut line) can sit close to / partially
  behind the centered bottom control bar — pre-existing, unchanged by these
  fixes, cosmetic only (mouse hint; not a required check).
- Mobile control bar is a single horizontally-scrollable row, so on the narrowest
  viewports the right-most control's text may be cut until the row is scrolled —
  by design (documented in MOBILE_FIX), not an overflow defect (doc width ==
  viewport width, no body/horizontal scroll).
- Small mobile body text ~13 px (programmatic, readable); not a failure.
- Sun rendered dark olive (stylistic, pre-existing); sizing dominance is correct.
- Base-harness "HUD header overlap" flag and desktop touchGesture probe are
  harness artifacts, not app defects (see above).

## Automated checks

typecheck PASS · 80/80 tests PASS · build PASS · all viewport desktop/mobile
layout checks PASS · `git status --short` clean after the final verification
commit.
