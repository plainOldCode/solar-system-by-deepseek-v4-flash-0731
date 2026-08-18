# DS4 Solar System — Logarithmic Solar System Demo

An interactive, browser-based **3D Solar System** from the Sun out to Pluto,
including 25 major moons, built on **Vite + TypeScript + Three.js** with
[`OrbitControls`](https://threejs.org/docs/#examples/en/controls/OrbitControls).
It uses **real NASA/JPL astronomical data** as the source of truth, then
compresses orbital distances with a **logarithmic scale** and independently
enlarges body sizes so the whole system fits on one screen and remains usable.

> Status: complete and validated. See the [Known limitations](#known-limitations)
> section for an honest account of what is and is not implemented.

---

## Quick start

```bash
npm install
npm run dev        # start the Vite dev server → http://localhost:5173
```

Requirements: Node.js 18+ and npm. (Verified on Node v26 / npm 11.)

## Development & build commands

| Command              | Purpose                                            |
|----------------------|----------------------------------------------------|
| `npm run dev`        | Vite dev server with hot reload                    |
| `npm run test`       | Run the Vitest suite (75 tests)                    |
| `npm run test:watch` | Vitest in watch mode                               |
| `npm run typecheck`  | `tsc --noEmit` (strict mode)                       |
| `npm run build`      | `tsc --noEmit` + production `vite build` → `dist/` |
| `npm run preview`    | Serve the production build locally                 |

The default view fits **Sun → Pluto** on one screen in log scale (spec §18.2).

---

## Controls

### Mouse / touch (OrbitControls)
| Input               | Action                                    |
|---------------------|-------------------------------------------|
| Left-drag           | Orbit the camera                          |
| Scroll / pinch      | Zoom                                      |
| Right-drag / two-finger | Pan                              |
| Click a body        | Select / focus that body                  |
| Click empty space   | Clear selection                           |

### Keyboard (when the canvas or page has focus)
| Key        | Action                                              |
|------------|-----------------------------------------------------|
| `▲` / `▼`  | Cycle to previous / next body (also `←`/`→`)        |
| `Space`    | Play / pause                                        |
| `Esc`      | Clear selection and return to the full-system view  |
| `Tab`      | Reach the control-bar buttons and body dropdown     |

### Control bar (bottom)
- **⏸ / ▶** — play / pause the simulation
- **속도 −/+** — step through the speed ladder (0.05× … 64×); default 1×
- **초기화** — reset simulation time to day 0 and speed to 1×
- **레이블 숨기기/표시** — toggle in-scene name tags
- **이동 ▲/▼ + dropdown** — previous/next body, or jump to any of the 35 bodies
- **홈** — return to the Sun-centred full view

Selecting a planet or moon moves the camera to it and pins the orbit pivot on
the moving body (follow-cam), so you can spin around it while the simulation
runs. The info panel shows that body's real values.

---

## Architecture

```
src/
  main.ts                  entry — mounts AppController into #app
  styles.css               global styles, responsive media queries, focus rings
  data/
    types.ts               CelestialBodyData model (units + provenance per field)
    solarSystemData.ts     35-body dataset (real NASA/JPL values, per-body source)
    validate.ts            dependency-free dataset + range/order validator
  core/                    Three.js-free, testable math + the scene graph
    ScaleManager.ts        log/linear distance & radius → scene-unit mappings
    orbit.ts               deterministic Keplerian orbitalPosition (Newton solver)
    SimulationClock.ts     deterministic time accumulation with speed + pause
    SolarSystem.ts         scene composition, lights, render loop, dispose
    CelestialBody.ts       a body's THREE.Group + Mesh, per-frame orbital update
    OrbitRenderer.ts       orbit-path guide lines from the same orbital math
    CameraRig.ts           OrbitControls + follow-on-selection + home
  ui/                      presentational layer (HUD)
    AppController.ts       composition root for selection/camera/sim/keyboard
    ControlPanel.ts        thin presenter wiring the static control bar DOM
    InfoPanel.ts           injects pure-formatted body info into the DOM
    Labels.ts              procedural canvas-sprites for in-scene Korean tags
    format.ts              pure info-panel string formatting (Korean)
    selectionModel.ts      pure selection order / intersection / focus-distance
    __tests__/             interaction unit tests
```

Layering (the whole point of the design):

- **Data** (`data/`) is raw astronomical facts only — no rendering, no math.
- **Core** (`core/`) is almost entirely pure, Three.js-free math
  (`ScaleManager`, `orbit`, `SimulationClock`) so it is trivially unit-testable
  and reusable; the `SolarSystem`/`CelestialBody`/`OrbitRenderer` are split so
  the scene graph (`buildViews`) can be tested headlessly without a
  `WebGLRenderer`.
- **UI** (`ui/`) is a thin presentational layer on top — it never reimplements
  scene or simulation logic.

### Simulation model
Positions are computed from **accumulated simulation time**, not frame count, so
behaviour is consistent across frame rates (spec §7): mean anomaly
`M = 2π·t/T + phase₀`, Kepler's equation solved by 5–10 Newton iterations, an
inclination rotation applied in 3D, and the per-frame group position scaled to
the body's log-rendered orbit radius. Every body uses its real relative period,
so relative orbital speeds and period ratios are preserved. Phases are seeded
deterministically from each body's id so planets/moons aren't all aligned at
perihelion, but the spread is reproducible.

---

## Data model, units, and sources

Real values — none invented in the rendering code. Each body record (see
`src/data/types.ts`) carries:

| Field                | Unit / values              | Notes                                  |
|----------------------|----------------------------|----------------------------------------|
| `id`                 | slug                       | unique, e.g. `jupiter`                 |
| `nameKo` / `nameEn`  | string                     | Korean + English                       |
| `type`               | `star` / `planet` / `dwarf-planet` / `moon` |         |
| `parentId`           | slug (moons only)          | planet/dwarf the moon orbits           |
| `radiusKm`           | km                         | actual radius                          |
| `semiMajorAxis` + `semiMajorAxisUnit` | `AU` (Sun→planet) or `km` (planet→moon) | heliocentric AU for planets/dwarf; km from parent for moons |
| `eccentricity`       | [0,1]                      | orbital eccentricity                   |
| `inclinationDeg`     | [0, 180]°                  | orbital inclination                     |
| `orbitalPeriodDays`  | days                       | sidereal period (signed = retrograde)  |
| `rotationPeriodHours`| hours                      | sidereal rotation (negative = retrograde) |
| `axialTiltDeg`       | [0, 180]°                  | display tilt                            |
| `displayColor`       | hex                        | procedural material colour              |
| `description`        | string (Korean)            | shown in info panel                     |
| `source`             | label                      | traceable provenance                    |

**35 bodies**: 1 star (Sun) + 8 planets + 1 dwarf planet (Pluto) + 25 moons.

### Data sources
- **Sun + planets**: [NASA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) values (radius, sidereal rotation/orbital period, semi-major axis, eccentricity, inclination, axial tilt).
- **Pluto (dwarf)**: [NASA Dwarf Planet Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) — Pluto's eccentricity ≈ 0.249 and inclination ≈ 17.16° are deliberately larger than the planets' so its orbit reads as noticeably tilted/elliptical (spec §7).
- **Moons**: [NASA Planetary Satellite Physical Parameters](https://ssd.jpl.nasa.gov/sats/elem/) / NSSDC satellite tables (radius, planetocentric semi-major axis, orbital period).

Precision is 3–5 significant figures — enough because the acceptance requirement
is **relative-order correctness** (distance order, size order, period order,
moon parentage + distance order, Pluto's high e/i), not arbitrary decimal exactness.

The dataset is validated at import/test time by `validate.ts`
(unique ids, hierarchy, unit contracts, numeric ranges, ordering, parent
existence), with 29 dedicated tests.

### Moon-selection criteria
Moons live in the data file (`solarSystemData.ts`) so more can be added without
touching the rendering engine. The 25 are a curated set of *major* moons: Earth's
single Moon; each planet's largest satellites; Saturn's major icy moons plus
Titan and Iapetus, and Uranus's five classic major moons (Miranda–Oberon);
Neptune's Triton; and all five of Pluto's known moons including Charon. They are
ordered by real orbital distance within each system and rendered ~2.5–9× the
parent's displayed radius (via the moon-distance log map), preserving their
real distance order.

---

## Scaling choices

**Two independent display mappings** (implemented in `ScaleManager.ts`) keep
the real data separate from what you see. Neither shares a single physical
scale with the other.

### Heliocentric distance — log by default
```
sceneDistance = distanceGain · log10(1 + km / distanceFloorKm)
```
With `distanceGain = 5.0` and `distanceFloorKm = 100_000`, and `1 AU ≈ 149.6M km`
(`AU_KM` = 149 597 870.7). Sun→Pluto (≈39.5 AU → 5.9e9 km) maps to ≈ 24.7 scene
units, comfortably inside the default camera. Log compression keeps Mercury,
Venus, Earth and Mars visually distinguishable while outer planets stay spread
out rather than collapsing into a band. The UI and this README both state that
the active distance representation is **logarithmic**.

### Body size — log by default, compressed (independent floor/cap)
```
sceneRadius = clamp( sunSceneRadius · ( log1p(radiusKm) / log1p(696340) )^compression , minRadius, maxRadius)
```
The Sun (`sunSceneRadius = 2.2`) anchors the scale; `log1p` normalization keeps
the ordering real while lifting Mercury/Pluto/moons above invisibility. The
compression exponent (`radiusCompression = 3.0`) then shrinks everything
smaller than the Sun so planets are clearly sub-dominant and distinguishable
from one another — Jupiter renders ~57% of the Sun's radius instead of 83%
(or ~70% of the Sun's *diameter* vs ~165% before), Earth ~28% instead of 65%,
so bodies read as discrete markers on their orbits rather than as
Sun-sized orbs. A floor (`minSceneRadius = 0.25`) and cap
(`maxSceneRadius = 10.0`) guarantee tiny moons stay visible. In the UI, body
count is the primary load driver, not polygon detail, so the modest sphere
tessellation keeps it smooth on typical desktop/mobile hardware.

### Physical vs visualization scale
Body size and orbital distance deliberately **do not share one uniform physical
scale**: distances are log-compressed and sizes are visibility-enlarged so the
complete system fits one screen. A `ScaleManager` internal **log/linear** switch
exists (`setDistanceMode`/`setRadiusMode`), but no selector is exposed in the UI
(see limitations) — the shipped default is log for both.

> Required disclaimer: *This visualization uses real astronomical data. However,
> orbital distances are compressed with a logarithmic scale and celestial-body
> sizes are visually enlarged so that the complete Solar System can be shown on
> one screen. Rendered body sizes and rendered orbital distances therefore do
> not share one uniform physical scale.*

---

## Accessibility
- Canvas is a labelled focus target (`role="img"`, `aria-label`), keyboard
  operable (arrows cycle bodies, Space plays/pauses, Esc clears, Tab reaches all
  controls).
- All controls are real `<button>`/`<select>` elements with accessible labels &
  tooltips; `aria-pressed` reflects play/label state.
- A visually-hidden `role="status"` live region announces selections and
  simulation state to screen readers.
- `:focus-visible` outlines for keyboard users; `prefers-reduced-motion` CSS.

---

## Known limitations

Honest accounting of what is implemented and what is not (deviations from the
spec are listed here rather than hidden):

- **Saturn's rings are not rendered** (spec §12 marks them mandatory). Saturn is
  currently a plain pale-yellow Lambert sphere.
- **No procedural star-field background** (spec §12/§14 star-field toggle).
  The background is a solid dark `#000` with a subtle fog gradient.
- **No UI selector for distance mode or size mode.** `ScaleManager` supports
  `log`/`linear` internally, and the code exposes `setDistanceMode` /
  `setRadiusMode`, but the control bar only ships the log defaults — the spec's
  *Log/Linear/Focus* distance modes and *Enhanced/Relative/Uniform* size modes
  are not selectable, and the "Focus Scale" (per-system local zoom) is not
  implemented as a scale mode.
- **Control bar is a subset of the spec §14 list**: play/pause, speed,
  reset, label toggle, body navigator, home. The *orbit visibility*, *moon
  visibility*, and *star-field visibility* toggles are not present.
- **Info panel shows real values only** (AU/km distances, km radius, day/hour
  periods, axial tilt). It does not yet list *eccentricity*, *inclination*, the
  *moon list*, or the *rendered distance/radius + active scale* values, so the
  real-vs-rendered distinction is documented here rather than shown per-body.
  Moon parent/kind is still announced via the type badge and alt text.
- **Moon labels don't auto-reveal on selection**; labels are an all-or-nothing
  toggle (spec §11 asks for density-by-selection).
- **Orbit guide lines are drawn at the body's mean log radius** — eccentricity
  changes the body's direction/motion but the drawn ring is a circle at the mean
  distance, so elliptical *paths* aren't drawn (bodies still visibly travel on a
  circle; Pluto's tilt reading stronger than that). The motion itself is
  Keplerian, so eccentricity affects where on the ring the body sits over time.
- **Info panel lacks a rendered vs real numeric split** (see above).
- **Planetary-system detail view (§13)** is partial: selection pins the camera
  to the body, but unrelated planets are not dimmed and there is no explicit
  "Back" beyond Home/Esc.
- Vendored dev toolchain reports npm audit findings (5 transitive, non-runtime);
  no runtime or production dependencies are affected.
- The WebGL scene was validated headlessly (SwiftShader) and via the full unit
  suite; live-GPU visual composition (lighting/colour balance, ring look)
  hasn't been eyeballed on physical hardware.

---

## Testing & release-readiness

- **75 unit tests** all pass (`npm test`): 29 data/validation + 24
  scaling/simulation + 7 scene construction + 15 interaction/UI-formatting.
- `npm run typecheck` passes (strict `tsc --noEmit`).
- `npm run build` succeeds: Vite emits `dist/index.html`, CSS, and a ~530 kB JS
  bundle (134 kB gzip). A "chunk > 500 kB" warning is informational only.
- Asset integrity: local `public/favicon.svg`; all labels/textures generated
  procedurally at runtime — **no external asset fetches**, so there is no
  network-load failure path.
- `.gitignore` excludes `node_modules/`, `dist/`, `.vite/`, `*.local`, `.DS_Store`;
  no secrets or generated junk are tracked.
- Runtime smoke check (headless Chrome + SwiftShader against `vite preview`):
  load 200, one WebGL canvas, 35 body options, selection → info panel + live
  region, play/pause, speed up/reset, Esc-home — with **zero console/page
  errors**.

See `DATA_PLAN.md` for the original data contract and validation plan.
