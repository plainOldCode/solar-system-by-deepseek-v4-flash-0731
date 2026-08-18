# DS4 Solar System — Focused Mobile Viewport & Interaction Fixes

Task `t_f93e5ba8` — implements the focused fixes recommended by the completed
mobile audit (`artifacts/MOBILE_AUDIT.md`). Work performed only in this repo.

Baseline Git
- Branch: `main` · HEAD before work: `d06be71bf48f89c264f49d885c9788402c8c547c` (clean)
- Set by commit `1d471ef` (ScaleManager planet sizing) + `d06be71` (audit).

Environment
- Host: macOS, Node v26.7.0 · Playwright Chromium + SwiftShader (headless)
- Served by Vite `npm run dev` on localhost:5173
- Harness: `artifacts/evidence/mobile-audit/harness.mjs`
  (reran unchanged on the fixed build → `artifacts/evidence/mobile-fix-v2/after-fix/`)

Checks
- `npm run typecheck` PASS · `npm run test` 80/80 PASS · `npm run build` PASS

---

## Fixes applied (committed together as one code change)

1. **Info-panel ↔ control-bar overlap (all mobile viewports).**
   Root cause (audit): mobile `.info-panel` used a fixed
   `bottom: calc(var(--control-h) + 76px)` clearance that assumed a single
   52px control row, but the bar wrapped to 2–4 rows on narrow screens.
   Fix: AppController now measures the live control-bar geometry via a
   ResizeObserver (`AppController.syncInfoPanelGap`) and sets the CSS custom
   property `--info-panel-bottom`, which the mobile media rule uses as the
   panel's bottom. This stays correct through re-wraps, browser-chrome shrink,
   and orientation changes.

2. **Control-bar footprint.** Mobile/landscape control bar is now a single
   62px-high row that scrolls horizontally (`flex-wrap: nowrap; overflow-x:
   auto`) instead of wrapping to a tall 2–4-row block (176px at 360w, 134px at
   844w). 360×800: bar 176px → 62px; 844×390: bar 134px → 62px.

3. **Touch targets.** Mobile `.ctrl-btn` height 32px → 44px with
   `min-width: 44px` (icons 44×44, select 44px tall). No more "small hit
   targets" warning on any mobile viewport. Desktop controls intentionally
   untouched (kept pixel-identical; preserved).

4. **Safe-area insets.** `env(safe-area-inset-*)` added to `.hud-header`,
   `.info-panel`, `.control-bar`, `.kb-hint`, and `height: 100dvh` (via
   `@supports`, 100% fallback) on `html/body/#app` so the canvas + fixed
   chrome track dynamic browser-chrome height.

## Results (verified in a real Chromium browser, all 4 viewports)

| Viewport | info ∩ control-bar | hit targets | control-bar height | page overflow | console errors |
|---|---|---|---|---|---|
| 360×800  | no overlap (716 < 728) | ≥44×44 | 176 → 62px | none | 0 |
| 390×844  | no overlap (760 < 772) | ≥44×44 | 134 → 62px | none | 0 |
| 844×390  | no overlap (306 < 318) | ≥44×44 | 134 → 62px | none | 0 |
| 1280×800 | PASS (preserved) | unchanged 32px | same h92 (top690/bottom782) | none | 0 |

Populated (Earth selected) overlap check: `ok` on all three mobile viewports.
Touch probe (`touchGesture`): `ok`. Canvas fills viewport, DPR capped at 2.

Note: the harness "HUD header does not overlap info panel" flag is a known
heuristic false positive (documented in the audit) — HUD is top-left
(y10–66) and info is bottom/top-right; their rects never coincide on screen.
All layout-critical checks pass.

Evidence: `artifacts/evidence/mobile-fix-v2/after-fix/` screenshots + metrics.json.
