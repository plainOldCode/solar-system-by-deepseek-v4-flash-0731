# DS4 Solar System — Independent Project Review

- **Review date:** 2026-08-19
- **Repo:** `/Users/m2max/ds4-solar-system` · branch `main` · `origin/main`
- **HEAD reviewed:** `cd5ec4f` (chore: update test tooling security dependencies)
- **Task:** `t_bcb507b0` — independent review vs the original implementation prompt (`threejs_solar_system_demo_prompt_en.md`, attached) and the current `README.md`.
- **Scope enforced:** only `docs/PROJECT_REVIEW.md` is changed. No application source, dependencies, configuration, or tests were modified. `/Users/m2max/solar-system-demo` was **not** inspected.

---

## 1. Overall verdict

**Verdict: SOLID / SHIP-WITH-NOTES (no critical findings).**

The core implementation is well-engineered, cleanly separated, heavily tested, and backed by unusually thorough real-browser (Chromium/SwiftShader WebGL) verification artifacts. The astronomical model, logarithmic scaling, Kepler-style orbital simulation, scene-graph structure, Sun emissive lighting, Saturn rings, deterministic selection identity, accessible HUD (including the Hide/Show Panels control), and the mobile layout work are all real and verified.

The gaps are **spec-completeness and UI-surface** issues rather than correctness defects. A meaningful cluster of prompt §10/§12/§13/§14 requirements — a procedural **star field**, the **distance/size-scale selectors**, **orbit/moon/star-field visibility toggles**, a **hover tooltip**, displayed **rendered + active-scale values** and a **moon list** in the info panel, and **selected-orbit highlighting / revealing moon orbits on focus** — are absent from the shipped UI. The README's "Known limitations" section only partially discloses this. There are no critical or high-severity *defects*; the items below are un-implemented features or documentation accuracy issues.

Verified gates on HEAD **cd5ec4f**: `npm run typecheck` → exit 0; `npm test` → **95/95** (6 files); `npm run build` → vite build OK (dist/assembled). Working tree clean (see §10).

---

## 2. Methodology & evidence used

This review is based on **direct repository inspection** of every source file (data, core, ui, styles, index.html), the git history and status, the committed verification artifacts under `artifacts/`, the attached implementation prompt, and the current README — plus a **fresh** tooling run (typecheck, 95/95 tests, build) performed in this review.

Sources of truth used:
- `src/data/solarSystemData.ts`, `src/data/types.ts`, `src/data/validate.ts`, `src/data/__tests__/solarSystemData.test.ts`
- `src/core/ScaleManager.ts`, `orbit.ts`, `SimulationClock.ts`, `CelestialBody.ts`, `OrbitRenderer.ts`, `SolarSystem.ts`, `CameraRig.ts`, `core/__tests__/scalingAndSimulation.test.ts`, `core/__tests__/scene.test.ts`
- `src/ui/AppController.ts`, `ControlPanel.ts`, `InfoPanel.ts`, `Labels.ts`, `hudVisibility.ts`, `selectionModel.ts`, `format.ts`, `ui/__tests__/*`
- `index.html`, `src/styles.css`, `vite.config.ts`, `.gitignore`, `package.json`
- `artifacts/FINAL_VERIFICATION.md`, `artifacts/VERIFICATION.md`, `artifacts/MOBILE_AUDIT.md`, `artifacts/MOBILE_FIX.md`, `DATA_PLAN.md`, and `artifacts/evidence/{integration, hud, sun-emissive, final-verification, mobile-*}`
- `git log` / `git status` (26 commits, clean tree, one remote)

**Verified facts** are stated plainly and cite files/symbols. Where the review relies on the committed evidence artifacts (real browser screenshots with measured viewport/touch/console metrics), those are labeled as evidence-based. Ambiguities or inferences are explicitly marked **ASSUMPTION**.

---

## 3. Requirement compliance (against the prompt)

| Prompt area | Status | Verified in |
|---|---|---|
| Body coverage — Sun, 8 planets, Pluto, 25 moons (35 total) | **Met** | `solarSystemData.ts` + tests |
| Real astronomical data, NASA/JPL sourced, correct relative order | **Met** | `DATA_PLAN.md`, tests (distance/radius/period/parentage/order) |
| Separate real data vs rendered scales | **Met** | `ScaleManager` (distance/radius kept separate) |
| Logarithmic heliocentric distance mapping | **Met** | `ScaleManager.distance`; used by `CelestialBody` + `OrbitRenderer` |
| Distance modes Log / Linear / **Focus** | **Partial** | Log default; Linear is an internal API mode (`setDistanceMode`), **Focus scale is not implemented** |
| Moon-orbit local scale (parent-local, log) | **Met** | `CelestialBody` (planetocentric) + scene-graph parenting |
| Moon-orbit visibility rules in full view | **Not met** | All moon lines always render at planet opacity (`OrbitRenderer` default) |
| Body-size enhanced/relative/uniform modes | **Partial** | `ScaleManager.radius` exposes log/linear internally; **no **size** mode UI (Relative/Uniform absent)** |
| Elliptical orbits (Kepler) with inclination in 3D | **Met** | `orbit.ts` (Kepler solver), `scene.test.ts` horizontal-plane test |
| Relative speed from real periods; adjustable multiplier | **Met** | `orbit.ts`, `SimulationClock` + `SPEED_LADDER_DAYS` |
| Default speed observable | **Met** | `DEFAULT_SPEED_DAYS=0.1` (README + `defaultRate.test.ts`) |
| `OrbitControls` orbit/pan/zoom; click body/empty | **Met** | `CameraRig`, `AppController.pickBody/resolveBodyPick` |
| Oblique initial camera, Sun→Pluto fits | **Met** (evidence) | `FINAL_VERIFICATION.md` home viewports; `CameraRig` home pos |
| Smooth camera focus; follow behavior | **Met** | `CameraRig.follow`, `AppController.select` |
| Raycast selection identity (click the exact body) | **Met** (fixed) | `resolveBodyPick` + `interaction.test.ts` regression |
| Hover tooltip (KO/EN/type) | **Not met** | Only cursor-change on hover; no tooltip element |
| Info panel: real + rendered values, active scales, moon list | **Partial** | `InfoPanel`/`formatBodyInfo` — **real values only**, no rendered/active-scale/moon-list rows |
| Required scale disclaimer visible in UI | **Not met** | Disclaimer text exists in README only; **no UI element** (index.html/styles.css) |
| Labels KO-primary + EN-secondary; density reduction | **Partial** | `Labels.paint` paints Korean only; no density/camera-distance reduction |
| Sun emissive + light source | **Met** (fixed) | `CelestialBody.buildMesh` star→`MeshBasicMaterial`; `SUN_EMISSIVE_EVIDENCE.md` |
| Saturn rings (mandatory); Uranian rings (optional) | **Met / N/A** | Saturn 3-band rings; Uranus rings not implemented (optional) |
| Procedural star field (mandatory §12) | **Not met** | No `THREE.Points`/star code anywhere in `src/` |
| Selected-orbit highlight, dim non-selected | **Not met** | `OrbitRenderer` fixed color/opacity; no per-selection styling |
| Planetary-system detail view with smooth scale transitions | **Partial** | Camera focus only; **no scale-morph / Focus-scale / moon-system enlargement** |
| Responsive desktop + mobile (touch targets, safe areas, dvh) | **Met** (evidence) | `styles.css` media rules, `MOBILE_FIX`, `FINAL_VERIFICATION` |
| `devicePixelRatio` cap | **Met** | `SolarSystem.ts` `Math.min(window.devicePixelRatio, 2)` |
| No per-frame allocations; reuse | **Met** | `CelestialBody.tmp`, `CameraRig.tmp`, geometry built once |
| Resize handling & disposal | **Met** | `SolarSystem.resize/dispose`, `AppController` |
| Accessibility (keyboard, live regions, focus) | **Met** | `AppController`, `hudVisibility`, `index.html` roles |
| TypeScript, no `main.ts` monolith, config constants | **Met** | multiple modules; constants in `ScaleManager.DEFAULTS`, `AppController` |
| Completion criteria #1–#15 on README/prompt | **Partially met** | #11 (UI disclaimer) and #14-na (no star field) unmet; see §5 |

---

## 4. Verified strengths

**Data model & provenance (verified).**
- `solarSystemData.ts` holds exactly 1 star + 8 planets + 1 dwarf + 25 moons = **35 bodies**. Parentage matches the prompt (§3): Moon/Earth; Phobos/Deimos/Mars; Io/Europa/Ganymede/Callisto/Jupiter; Mimas–Iapetus/Saturn; Miranda–Oberon/Uranus; Triton/Neptune; Charon/Styx/Nix/Kerberos/Hydra/Pluto.
- Real values are consistent with standard NASA/JPL figures (spot-checked: Mercury 0.387 AU / e 0.2056 / 87.969 d; Earth 1.0 AU / 365.256 d; Jupiter 5.203 AU / 4332.59 d / 69,911 km; Pluto 39.482 AU / e 0.2488 / i 17.16°; Moon 384,400 km / 27.322 d; Phobos 9,376 km / 0.3189 d; Charon 19,591 km / 6.387 d; Saturn ring band edges match real C/B/A ring radii). Relative distance order, size order, period-order, moon-distance order, and Pluto's high e/i are **asserted by tests** (`solarSystemData.test.ts`, `validate.ts`).
- Data is fully separated from rendering (`types.ts`, `validate.ts`), and `validate.ts` catches duplicates, missing parents, unit mismatch, and ordering defects.

**Scaling & orbital math (verified).**
- `ScaleManager` implements the log-distance and compressed-radius mappings from the README formulas, with sane clamps/floors, monotonic and deterministic (numerous unit tests).
- `orbit.ts` solves Kepler's equation (Newton–Raphson) for true elliptical motion, applies inclination in 3D, is periodic/deterministic, and keeps relative period ratios (no per-planet arbitrary speeds).
- `CelestialBody`/`OrbitRenderer` share the same `ScaleManager` + `orbitalPosition`, so **each body travels exactly along its drawn ring** (tested in `scene.test.ts`).

**Scene graph & rendering (verified).**
- Parent–child planet→moon hierarchy under a Sun-root; moons move with their planet via world transforms (tested).
- Horizontal, plane-like default composition via `SolarSystem.buildViews` `root.rotation.x = -π/2` (regression test):
- Sun emissive/self-lit via `MeshBasicMaterial` (tested); point light at origin still shapes planet daylight.
- Saturn's 3-ring system is proportionally real and tilted (evidence screenshots).
- Procedural materials only — **no external texture download**, satisfying the "must work without textures" requirement.

**Interaction, a11y, mobile (verified/evidence).**
- `resolveBodyPick` deterministically prioritizes body spheres over orbit lines (fixes the Earth→Venus mis-selection; regression-tested).
- Keyboard navigation, focus management, `aria-pressed`/`role`/live regions are implemented across controls.
- Hide/Show Panels is group-collapsible, keyboard-recoverable, focus-managed (`hudVisibility.ts`), and preserves label preference.
- Mobile: 44px touch targets, `100dvh`, `safe-area-inset-*`, single scrollable control row, and runtime-measured info-panel clearance (no overlap) — all with 4-viewport real-browser evidence.

**Build/test evidence (fresh run).**
- `npm run typecheck` → exit 0 (strict). `npm test` → 95/95. `npm run build` → OK.

---

## 5. Findings by severity

### Critical
- **None.**

### High — spec-required features absent from the shipped UI (verified by code search)
- **H1. No procedural star field.** Prompt §12 mandates a "procedurally generated star field"; §14 lists a star-field visibility toggle. A search for `THREE.Points`, `Points`, `StarField`, `particle`, `addStars` finds nothing in `src/`. The default scene (documented dark/black background) is correct, but the mandatory star field is missing. (Verified by absence of any star/points code.)
- **H2. Control-panel feature set is incomplete vs §14.** The prompt's Control Panel requires: distance-scale selector, size-scale selector, orbit-visibility toggle, moon-visibility toggle, star-field toggle, camera reset. The shipped, fully-wired control bar (`index.html`) exposes: play/pause, speed ±/reset, labels toggle, Hide-Panels, body prev/next, body select, home. **There is no distance-scales selector, no size-scales selector, and no orbit/moon/star-field visibility toggles.** Scales exist only as internal API methods (`ScaleManager.setDistanceMode/setRadiusMode`) with no UI binding — matching the README's limitation note, but the missing toggles and the missing **Focus** distance mode (§4) are not disclosed.
- **H3. Info panel does not distinguish real vs rendered values, show active scales, or list moons (§10).** `InfoPanel.setBody`/`formatBodyInfo` (`src/ui/format.ts`) render only **real** orbital distance, radius, period, rotation, axial tilt. The prompt requires the panel to also show **current rendered distance, active distance scale, current rendered radius, active size scale, and a moon list**, explicitly separating real from rendered. None of these rendered-value rows or the moon list exist. This is also the reason completion criterion #11 (explicit UI explanation of the shared-scale caveat) is unmet.
- **H4. No visible scale disclaimer in the UI (§14).** The required "visible explanation" that distances/sizes do not share one physical scale exists only in `README.md`; there is **no element** in `index.html`/`styles.css` carrying it.

### Medium
- **M1. Moon orbit lines are always rendered at planet-line opacity.** Every non-Sun body gets an orbit line at `ORBIT_LINE_OPACITY = 0.35` (`OrbitRenderer`), including all moons, with no global-view hiding/fading (§5 "hide or greatly reduce the opacity of moon orbit lines in the full Solar System view", §13 "Hide moon orbit lines by default or render them very faintly") and no reveal-on-selection behavior. This adds visual clutter around each planet in the global view.
- **M2. No selected-orbit highlight / dimming of others (§12).** All orbit lines share a fixed color/opacity; there is no logic to highlight the selected body's orbit and dim the rest.
- **M3. "Planetary-system detail view" is only a camera focus, not a scale transition.** §5/§13 ask for enlarging/clarifying the local moon system on selection and smooth scale interpolation. The implementation (`AppController.select`) preserves scale and simply frames/centers the body with a camera move (`focusDistanceFor`); moon sizes and orbit-line emphasis do not change, and the **Focus** distance mode is absent. Moons remain readable because their local log scale keeps them off their parent, but the "enlarge its moon system" behavior is not implemented. **(ASSUMPTION note:** "enlarge/clarify" is evaluated as absent because no scale/style change to the moon group occurs on selection; the only per-frame change is the orbit-pivot follow in `CameraRig`. VERIFIED that no moon-group scaling exists in `AppController`/`CelestialBody`.)
- **M4. In-scene labels are Korean-only, with no density management.** `Labels.paint` renders only `nameKo`; the prompt's "Korean primary / English secondary" example (목성 / Jupiter) is not shown on the sprite. Labels also are not culled/reduced by camera distance or selection state, nor gated to appear for moons only on parent selection (§11). Occlusion hiding works via `depthTest: true` (verified). **ASSUMPTION:** the intended behavior of reducing label density on zoom-out is not implemented (no such logic found).

### Low
- **L1. README cites commit hashes that do not exist in this repo.** `README.md` says "the final focused selection/size fix is recorded in commit `3228e23`; the Sun emissive fix is recorded in `fa6a673`." Neither hash exists in `git log --all` here (the actual commits are `30ffcaa` and `f28284b`). These are almost certainly from the sibling/older lineage. On a public repo (`github.com/plainOldCode/…`, see §8) this is misleading and should be corrected.
- **L2. No license file.** README correctly flags "No license has been selected yet." `private: true` in `package.json`, so the risk is low, but the absence should be resolved before general public distribution.
- **L3. Single 535 kB JS bundle (135 kB gzip)** triggers Vite's `>500 kB` chunk warning. The code is otherwise disciplined about per-frame allocation; this is only about initial download/parse. **ASSUMPTION** (no profiling run): size comes primarily from the three.js dependency + OrbitControls; a `manualChunks` or dynamic-import split would silence the warning.
- **L4. Per-body provenance is coarse.** Every moon shares the single broad label `"NASA/NSSDC Planetary Satellite Fact Sheets (moon data)"`; planets share "NASA/NSSDC Planetary Fact Sheet (planet data)". No per-value citations or a sources table mapping each number to a page are committed. The README lists the three top-level sources, which satisfies §15's minimum, but traceability is at dataset granularity, not per-record.
- **L5. `prefers-reduced-motion: reduce` only strips CSS transitions.** The rAF animation loop, camera damping, and follow-motion are not affected. **ASSUMPTION:** this is acceptable for an explicit simulation visual, but a stricter a11y posture could gate the auto-play or camera easing under reduced motion.
- **L6. Desktop controls remain 32 px.** Intentional and documented (mouse-only; mobile is ≥44 px). Descriptor, not a defect.

### Notes (not findings)
- **Uranus rings (§12, "when practical")** — appropriately omitted; optional.
- **`.kb-hint` can sit close to the centered control bar** on desktop (documented in `FINAL_VERIFICATION` known limitations); cosmetic.
- **The "HUD header overlap" harness flag** is a documented heuristic false positive (HUD is top-left, info panel is top-right/bottom); raw rects confirm no real overlap.

---

## 6. Prioritized recommendations

1. **(High-effort, high-value) Implement the star field.** Add a small `THREE.Points`-based procedural star background and an optional visibility toggle — this satisfies prompt §12/§14 and completes the "space" read. Respect the DPR cap and avoid per-frame allocation (build the `Points` geometry once).
2. **(High) Surface the scale selectors.** Bind `ScaleManager.setDistanceMode` (log/linear) and add a size-mode selector (enhanced/relative/uniform) to the control panel, exposing the already-implemented internal APIs.
3. **(High) Extend the info panel to show rendered + active-scale values and a moon list** (prompt §10 example: rendered orbital radius, active distance scale, rendered radius, active size scale), and add the required **visible scale disclaimer** to the UI (§14) rather than only the README.
4. **(Medium) Orbit-emphasis behavior.** In global view, fade moon orbit lines (e.g. to 0.1) and reveal them on parent selection; highlight the selected body's orbit and dim others (§12/§13).
5. **(Medium) Labels — show English as secondary on the sprite** and implement camera-distance/selection density reduction (§11).
6. **(Low, quick) Fix the README commit references** (`3228e23`→`30ffcaa`, `fa6a673`→`f28284b`) so public readers aren't misled.

---

## 7. Security / public-repository readiness (verified)

- `.gitignore`: `node_modules/`, `dist/`, `.vite/`, `*.local`, `.DS_Store` — the `dist/` build output is **not tracked** (confirmed via `git ls-files dist` empty) and `git status --short` is clean after a fresh build.
- `package.json` is `"private": true`. No `.env`, API keys, or credentials in tracked files. The remote is `https://github.com/plainOldCode/solar-system-by-deepseek-v4-flash-0731.git` (public GitHub, read-only fetch/push visible).
- Prior commit `7d8c4b8 "security: remove personal paths from verification artifacts"` indicates paths were already scrubbed from committed artifacts — verified: evidence docs use placeholders like `<project-root>` and measured values, no personal paths.
- Residual: **no LICENSE** (README acknowledges), and the **stale commit hashes** in README (L1) could mislead on a public repo. The leaked `sourcemap: true` in build config only matters if `dist/` were published; `dist/` is gitignored so harmless here.

---

## 8. Documentation & provenance (verified)

- README and README.ko.md document: data sources (NASA/NSSDC fact sheets, JPL SSD), the distance-scaling formula, the body-radius formula, the physical-vs-visual-scale distinction, moon-selection criteria, and install/run instructions — satisfying §15.
- `DATA_PLAN.md` records the full data contract, per-body field/unit model, hierarchy, and validation strategy.
- Caveat: the required **UI-scale disclaimer** (content of §14/README note) is **not present as a visible element** — see H4.

---

## 9. Test/build evidence

Run fresh during this review on HEAD `cd5ec4f`:
```
npm run typecheck  → exit 0 (tsc --noEmit)
npm test           → 95/95 passed, 6 files, 185ms
npm run build      → tsc + vite build OK; dist/assets 534.82 kB JS (135.62 kB gzip) + 6.26 kB CSS
```
Evidence artifacts (committed, from prior real Chromium/SwiftShader runs) include 4-viewport desktop/mobile layout & touch-target metrics, orientation/resize/motion checks, zero console/page errors, Sun-emissive before/after, HUD hide/show keyboard round-trips, integration run, and the deterministic-pick regression — see `artifacts/{FINAL_VERIFICATION.md, VERIFICATION.md, MOBILE_AUDIT.md, MOBILE_FIX.md}` and `artifacts/evidence/`.

---

## 10. Known limitations (acknowledged in README vs found in review)

README's stated limitations are accurate as far as they go:
- "alternative scale modes are implemented as internal APIs rather than a complete user-facing scale-mode editor" — **true**, and this review concurs (H2).
- "procedural star-field density and some advanced planetary surface detail remain intentionally lightweight" — **partially misleading**: there is **no star field at all**, not merely a lightweight one (H1).
- "model is an educational visualization, not a high-precision ephemeris" — **true**.

Review additionally found undocumented gaps: missing UI scale disclaimer (H4), missing rendered-value/moon-list info rows (H3), missing orbit/moon/star-field toggles (H2), missing selected-orbit highlight (M2), Korean-only labels (M4), and stale README commit refs (L1).

---

*Prepared by the DS4 review run for task `t_bcb507b0`. Sole intended file change: this report.*
