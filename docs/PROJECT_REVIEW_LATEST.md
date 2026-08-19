# DS4 Solar System — Independent Review (Latest State)

- **Review date:** 2026-08-19
- **Repo:** `/Users/m2max/ds4-solar-system` · branch `main` · `origin/main`
- **HEAD reviewed:** `f753539` (docs: document Sun glow halo and warm PointLight, update test count to 139/139)
- **Task:** `t_063afe3d` — independent re-review of the latest state after the documentation updates, vs the original implementation prompt (`threejs_solar_system_demo_prompt_en.md`) and the current `README.md`/`README.ko.md`, building on the baseline review (`docs/PROJECT_REVIEW.md` = `3cf4558`, and the attached `PROJECT_REVIEW_BASELINE.md`).
- **Scope enforced:** only `docs/PROJECT_REVIEW_LATEST.md` is changed. No application source, dependencies, configuration, or tests were modified. `/Users/m2max/solar-system-demo` was not inspected.

---

## 1. Overall verdict

**Verdict: SOLID / SHIP-WITH-NOTES (no critical or high-severity findings).**

The baseline review's high/medium gaps have all been implemented and are present in the shipping source, wired through the UI, and covered by tests:
the procedural star field with a toggle, the Log / Linear / **Focus** distance selectors, the Enhanced / Relative / **Uniform** size selectors, the orbit / moon / star-field visibility toggles, the hover tooltip (KO/EN/type), the info panel's **rendered-values + active-scale + moon-list rows**, the on-screen scale disclaimer, true elliptical orbit guides with selected-orbit highlighting and moon-orbit reveal-on-focus, English-secondary labels, and camera-distance label-density reduction. On top of that, the newest Sun features (procedural halo + warmed PointLight + `fog:false` self-lit Sun) are in and behave as documented.

Every feature claimed in the READMEs is backed by real source. Fresh tooling run on HEAD `f753539` confirms `npm run typecheck` → exit 0, `npm test` → **139/139** (8 files), `npm run build` → vite production build OK. Working tree is clean.

The remaining gaps are **low-severity / non-blocking** items plus **stale committed evidence artifacts** (older HEAD snapshots) and one stale commit-reference concern that is now resolved in the README. Detail below.

---

## 2. Methodology & evidence used

Direct repository inspection of every source file, git history/status, committed evidence under `artifacts/`, the attached implementation prompt and baseline review, both READMEs, plus a fresh read-only tooling run. I did **not** re-launch a browser in this review; I rely on the committed real-Chromium/SwiftShader evidence and cross-check claims against source + tests.

Sources of truth inspected:
- `src/data/solarSystemData.ts`, `types.ts`, `validate.ts` (+ test)
- `src/core/{ScaleManager,orbit,SimulationClock,CelestialBody,OrbitRenderer,SolarSystem,CameraRig,StarField,SunHalo}.ts` (+ core tests)
- `src/ui/{AppController,ControlPanel,InfoPanel,HoverTooltip,Labels,hudVisibility,selectionModel,format}.ts` (+ ui tests)
- `index.html`, `src/styles.css`, `src/main.ts`, `package.json`, `tsconfig.json`
- `artifacts/*` — `FINAL_VERIFICATION.md` (HEAD `be2ea97`), `MOBILE_AUDIT.md`, `MOBILE_FIX.md`, `VERIFICATION.md`, `artifacts/evidence/{integration,sun-glow,final-verification,hud,mobile-*,smoke-traces}`
- `docs/PROJECT_REVIEW.md` (baseline review), `DATA_PLAN.md`
- `git log` (34 commits) / `git status` (clean, one remote, `origin/main == HEAD`)

**Fresh checks run during this review** (read-only): `npm run typecheck` → exit 0; `npm test` → 139/139, 8 files, 256ms; `npm run build` → vite OK (dist/index.html 7.43 kB, css 8.64 kB, js 552.68 kB gzip 140.53 kB, map 2204 kB — see L1); `git diff --check` clean; `git status` clean; `git ls-files dist` empty.

---

## 3. Requirement compliance (against the prompt) — updated vs baseline

| Prompt area | Status | Verified in |
|---|---|---|
| Body coverage — Sun, 8 planets, Pluto, 25 moons (35 total) | **Met** | `SOLAR_SYSTEM`; `solarSystemData.test.ts` |
| Real astronomical data, NASA/JPL sourced, correct relative order | **Met** | `DATA_PLAN.md`, data + validation tests (distance/radius/period/parentage/order) |
| Separate real data vs rendered scales | **Met** | `ScaleManager` (distance/radius kept separate); `format.ts` uses live `ScaleManager` for rendered rows |
| Logarithmic heliocentric distance mapping | **Met** | `ScaleManager.logDistance`, used by `CelestialBody` + `OrbitRenderer` |
| Distance modes Log / Linear / **Focus** | **Met** (now) | `DistanceScaleMode = log|linear|focus`; `focusDistance` re-anchors on `focusKm`; `#dist-mode` selector wired via `ControlPanel`/`AppController.applyDistanceMode`; `applicable` — baseline gap **H2 closed** |
| Moon-orbit local scale (parent-local, log) | **Met** | `ScaleManager.localDistance` used for moons in `computeRingSceneRadius`; scene-graph parenting |
| Moon orbit visibility in full view (faint) | **Met** (now) | `MOON_ORBIT_FAINT_OPACITY=0.12` default; `setMoonEmphasis`; baseline gap **M1 closed** |
| Body-size modes enhanced / relative / uniform | **Met** (now) | `RadiusScaleMode`; `#size-mode` selector; `applySizeMode`; baseline gap **H2 closed** |
| Elliptical orbits (Kepler) + inclination 3D | **Met** | `orbit.ts` (Newton–Raphson Kepler solver); `OrbitRenderer` true-ellipse guides; `scene.test.ts` |
| Relative speed from real periods; adjustable multiplier | **Met** | `orbit.ts`, `SimulationClock`, `SPEED_LADDER_DAYS` |
| Default speed observable / documented | **Met** | `DEFAULT_SPEED_DAYS=0.1`; `defaultRate.test.ts`; README |
| `OrbitControls` orbit/pan/zoom; click body/empty click | **Met** | `CameraRig`, `AppController.pickBody/resolveBodyPick/onClick` |
| Oblique initial camera, Sun→Pluto fits | **Met** (evidence) | `final-verification` screenshots; `CameraRig.homePosition (0,28,42)`; integration evidence |
| Smooth camera focus / follow (ease-in-out) | **Met** | `CameraRig.follow`; `AppController.select` (clamped focus distance) |
| Raycast selection identity (deterministic) | **Met** (fixed) | `resolveBodyPick`; `interaction.test.ts` regression |
| Hover tooltip (KO/EN/type) | **Met** (now) | `HoverTooltip`; `#hover-tooltip` markup + CSS; baseline gap **H3/H-tooltip closed** |
| Info panel real + rendered values, active scales, moon list | **Met** (now) | `InfoPanel` rows "궤도 거리(실측)/렌더 거리/거리 스케일/반지름(실측)/렌더 반지름/크기 스케일/…"; `directMoonsOf` moon list; baseline gap **H3 closed** |
| Required scale disclaimer visible in UI | **Met** (now) | `#scale-disclaimer` element (index.html) + CSS `.scale-disclaimer`; baseline gap **H4 closed** |
| Labels KO-primary + EN-secondary; density reduction | **Met** (now) | `Labels.paint` shows `nameKo` + `nameEn`; `setCrowdFade` density; `shouldShowLabel` moon reveal; baseline gap **M4 closed** |
| Sun self-lit + light source; glow halo | **Met** | `CelestialBody` star → `MeshBasicMaterial{fog:false}`; `SunHalo` procedural additive halo; `SolarSystem.addLights` warmed `PointLight(0xfff1c8,800,0,2)`; `sunhalo.test.ts` + scene test |
| Saturn rings (mandatory); Uranian rings (optional) | **Met / N/A** | 3-band real-ratio Saturn rings, tilted; Uranus rings intentionally omitted (optional) |
| Procedural star field (§12) + visibility toggle (§14) | **Met** (now) | `StarField.ts` (`THREE.Points`, seeded, star count reduced on mobile); `#ctrl-stars` toggle; baseline gap **H1 closed** |
| Selected-orbit highlight, dim non-selected | **Met** (now) | `applySelectedEmphasis` (`SELECTED_ORBIT_*` vs `UNSELECTED_ORBIT_OPACITY`); baseline gap **M2 closed** |
| Planetary-system detail view / moon reveal on focus | **Met** (now) | `setMoonEmphasis` + `applySelectedEmphasis` (moon orbits brighten) + `setMoonEmphasis`/`labels.setSelection` moon labels; baseline gap **M3 (moon reveal part) closed** |
| Responsive desktop + mobile (touch targets, safe areas, dvh) | **Met** (evidence) | CSS media rules; harness metrics (44px targets, 100dvh, safe-area) |
| `devicePixelRatio` cap | **Met** | `Math.min(window.devicePixelRatio, 2)`; harness confirms effective DPR 2 |
| No per-frame allocations; reuse | **Met** | `CelestialBody.tmp`, `CameraRig.tmp`, geometry built once, `StarField`/`SunHalo` singleton textures |
| Resize handling & disposal | **Met** | `SolarSystem.resize/dispose`, `AppController` + `Labels.dispose` |
| Accessibility (keyboard, live regions, focus) | **Met** | `AppController`, `hudVisibility.ts`, roles/aria, `sr-only` live region |
| TypeScript, no `main.ts` monolith, config constants | **Met** | modular layout; constants in `ScaleManager`, `OrbitRenderer`, `AppController` |
| Completion criteria #1–#15 | **Fully met** (now) | previously-unmet #11/#14-na (UI disclaimer, star field) are now present; see §5 |

---

## 4. Verified strengths (post-documentation state)

**Data model & provenance** — exactly 35 bodies; parentage matches §3; real values consistent with NASA/JPL; ordering asserted by tests. Each body now carries a `source` field (planets / pluto / moons provenance sets) so the dataset is traceable at record granularity (an improvement over the previous review's L4).

**Scaling & orbital math** — `ScaleManager` implements all three distance modes (log default, linear, focus re-anchored) and all three size modes (enhanced log, relative, uniform), all monotonic and deterministic with unit tests. `orbit.ts` is a genuine Newton–Raphson Kepler solver; `OrbitRenderer` samples it to draw true-ellipse guides (eccentricity + inclination preserved, parent at focus) that match each body's motion exactly (shared `ringSceneRadius` `k` factor).

**Rendering & scene** — horizontal plane-like composition via `root.rotation.x=-π/2`; Sun self-lit `fog:false` `MeshBasicMaterial` + restrained 4.5× procedural additive halo (module-singleton canvas texture, no per-frame allocation, scale-mode-aware) + warmed `PointLight` shaping believable daylight on planets; real 3-band Saturn rings (with Cassini division) tilted; star field built once with mobile-reduced count; selected-orbit highlight/dimming and moon-orbit faint/emphasized opacity all pure + headless-testable.

**Interaction, a11y, mobile** — deterministic `resolveBodyPick`; ARIA roles/aria-pressed/live regions/focus restoration; keyboard nav (arrows/space/esc); Hide/Show Panels group + persistent affordance; tooltip is `pointer-events:none` so selection is unaffected; label sprites KO-primary + EN-secondary with crowd-fade density reduction and moon-label reveal on focus; mobile info-panel clearance via ResizeObserver-measured `--info-panel-bottom`; 44px touch targets, 100dvh, safe-area insets, horizontally-scrollable single-row control bar on narrow.

**Performance** — DPR capped at 2, geometry built once, reused temp vectors, singleton textures, no per-frame allocation, resize/dispose paths complete.

**Build/test evidence (fresh run on `f753539`)** — `npm run typecheck` exit 0; `npm test` **139/139** (8 files) matching the README's claim; `npm run build` OK. `git diff --check` clean; `git status` clean; `dist/` untracked.

---

## 5. Remaining gaps by severity

### Critical
- **None.**

### High — none (all baseline H1–H4 are implemented and verified).

### Medium — none new; baseline M1–M4 all implemented (see §3).
- The one deliberately-scaled-back item: the **planetary-system "detail view"** (§5/§13 ask to *enlarge/clarify the local moon system* on selection). What exists is equivalent behavior delivered differently: on focus the selected system's moon orbit lines are emphasized and moon labels reveal, while the heliocentric log/focus composition stays intact. There is no separate "moon-system enlargement" style change — the focused system reads clearly through orbit-line emphasis + label reveal rather than geometric enlargement. This is a design choice, not a defect. **(ASSUMPTION note** — verified no moon-group scale mutation occurs; emphasis is via opacity/labels.)

### Low
- **L1. Single large JS bundle + a sourcemap.** Build emits one 552.68 kB JS (140.53 kB gzip, 2204 kB sourcemap). Vite warns "chunks > 500 kB". This is download/parse cost only (the runtime is disciplined about per-frame allocation); a `manualChunks`/dynamic-import split or raising `chunkSizeWarningLimit` would silence it. (Carried from baseline L3; grew slightly because the new modules were added.) **ASSUMPTION**: no profiling run performed; size is dominated by the three.js dependency.
- **L2. No license file.** `private: true` in package.json; README acknowledges. Resolve before general public distribution.
- **L3. `prefers-reduced-motion: reduce` only strips CSS transitions.** The rAF loop, camera damping, and follow-motion ignore it. **ASSUMPTION**: acceptable for an explicit simulation visual, but a stricter posture could gate auto-play/easing.
- **L4. Desktop controls remain 32 px** (mouse-only; mobile ≥44 px). Documented; descriptor, not a defect.

### Notes (not findings)
- **Uranus rings** (§12 "when practical") — appropriately omitted; optional.
- **`.kb-hint`** can sit close to the centered control bar on desktop — cosmetic, documented in the final-verification-known-limitations.

---

## 6. Stale documentation / evidence

- **`docs/PROJECT_REVIEW.md` and the attached `PROJECT_REVIEW_BASELINE.md` are superseded.** They describe the state at HEAD `cd5ec4f` (95/95 tests) and correctly listed H1–H4/M1–M4 as gaps — those gaps no longer exist. `PROJECT_REVIEW_BASELINE.md` is a point-in-time snapshot and should not be treated as current. **This `PROJECT_REVIEW_LATEST.md` supersedes it.** (No edit was made to the baseline; it is left intact as a record.)
- **Committed evidence artifacts describe earlier HEADs, not `f753539`:**
  - `artifacts/FINAL_VERIFICATION.md` claims "HEAD `be2ea97`" and "80/80 tests" — that predates the star field, scale/toggle UI, tooltip, info-panel rows, disclaimer, elliptical guides, and the Sun halo. The metrics/screenshots are still structurally valid for layout, but the test count and feature set are stale relative to the README.
  - `artifacts/evidence/integration/INTEGRATION_EVIDENCE.md` describes an older 3-commit integration (91/91 tests) — a valid snapshot, now dated.
  - **The newest committed browser evidence matching the current feature set is `artifacts/evidence/sun-glow/` (139/139, real Chromium/SwiftShader, desktop + mobile, zero console/page errors)** — this is the most current real-browser evidence and is consistent with HEAD. Note it covers the Sun features and baseline layout, not an exhaustive re-run of every *new* control (star/toggle/tooltip/disclaimer); those are verified here by direct source + unit tests, and by the README's own verification bullet claims from the integration task lineage.
  - **Diagnosis:** the repo's browser-evidence is lagging — the newest features (star field, scale selectors, visibility toggles, tooltip, info-panel rendered rows, disclaimer, elliptical guides, selected-orbit highlight, EN labels, moon reveal) do not yet have their own committed real-browser screenshots/metrics at the current HEAD. Recommended (not blocking): run the existing Playwright harness once against `f753539` and commit a single consolidated evidence snapshot, so the committed evidence again covers the full current feature set.
- **README commit references are now correct** — the current README lists `501657b`, `30ffcaa`, `f28284b`, `84e7a07`, `ac15c8d`, `4731883`, `55c8019`, all of which exist in `git log` (verifying these resolved the baseline L1 "stale hashes" finding — the code now and README now agree).

---

## 7. Security / public-repository readiness

- `.gitignore` covers `node_modules/`, `dist/`, `.vite/`, `*.local`, `.DS_Store`; `git ls-files dist` is empty and `git status` clean after a fresh build.
- `private: true`; no `.env`, API keys, or credentials in tracked files; remote is the public `github.com/plainOldCode/…` (read-only fetch/push seen).
- Prior `7d8c4b8 "security: remove personal paths"` scrubbed personal paths from committed artifacts — evidence docs use `<project-root>` placeholders (confirmed current too).
- Residual from baseline: **no LICENSE** (README acknowledges). `dist/` is gitignored, so the sourcemap in the build only matters if `dist/` is ever published — harmless here.

---

## 8. Prioritized recommendations

1. **(Low-effort, highest remaining value) Commit a fresh consolidated browser-evidence snapshot at HEAD.** Run the existing Playwright harness (reuse `artifacts/evidence/*/*.mjs`) once against `f753539` desktop + mobile, capture star-field/toggle/tooltip/info-panel/disclaimer screenshots + metrics + zero-error proof, and commit it so committed evidence again matches the full current feature set (closes §6 evidence lag).
2. **(Low) Silence the chunk warning / trim initial payload.** Either `manualChunks` to split out three, or accept and document: bump `build.chunkSizeWarningLimit` or note in README. Purely initial-download, not runtime. (L1)
3. **(Low) Add a license.** Pick an MIT/Apache-2.0 (or user's preference) LICENSE file; update the README license note. (L2)
4. **(Low) Consider `prefers-reduced-motion: reduce`** gating auto-play/camera easing in addition to CSS transitions. (L3)
5. **(Optional, design) Moon-system "enlargement".** If the §5/§13 "enlarge/clarify the local moon system" wording must be taken literally, add a subtle scale-up of the focused system's moon orbits on focus; otherwise keep the current emphasis-based approach and clarify the design note in the README. Currently delivered via opacity/labels, which is reasonable. (Medium only if the literal requirement is insisted upon.)

---

*Prepared by the DS4 review run for task `t_063afe3d`. Sole intended file change: this report.*
