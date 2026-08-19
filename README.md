# DS4 Solar System

An interactive 3D Solar System visualization built with **Vite, TypeScript, and Three.js**. It presents the Sun through Pluto and 25 major moons using real astronomical data, while applying independent logarithmic distance and visibility-oriented body-size mappings so the complete system remains understandable in one view.

**한국어 문서:** [README.ko.md](README.ko.md)

## Source prompt

This project was implemented from the following prompt:

[Three.js Logarithmic Solar System Demo — implementation prompt](https://gist.github.com/plainOldCode/fb2e3ea48caada23107704628c2a9384)

## Features

- Sun, eight planets, Pluto, and 25 curated major moons.
- NASA/JPL-based astronomical values for radius, orbital distance, period, rotation, eccentricity, inclination, and parent-body relationships.
- Logarithmic heliocentric distance mapping with independent body-radius scaling.
- Horizontal, plane-like default Solar System composition with visible 3D orbital inclinations.
- Kepler-style time-based orbital motion with preserved relative period ratios.
- Sun rendered as a bright self-illuminated body; Saturn rings and planetary lighting are included.
- Three.js `OrbitControls` for orbit, pan, and zoom.
- Deterministic body selection: body spheres take precedence over orbit-guide hits.
- Camera focus for planets, dwarf planet Pluto, and major moons.
- Korean-primary labels with English secondary names.
- Accessible HUD controls, including global **Hide Panels** / **Show Panels** controls.
- Responsive desktop and mobile layouts with touch-sized controls and safe-area handling.
- Procedural materials and local assets; no runtime texture download is required.

## Quick start

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173/`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server with hot reload |
| `npm run typecheck` | Run strict TypeScript checking |
| `npm test` | Run the Vitest suite |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run build` | Typecheck and create the production build in `dist/` |
| `npm run preview` | Serve the production build locally |

## Controls

### Mouse and touch

- Left drag: orbit the camera
- Wheel or pinch: zoom
- Right drag or two-finger drag: pan
- Click a body: select and focus it
- Click empty space: clear the current selection

### Keyboard

- Arrow keys: move through the body selection order
- Space: play/pause the simulation
- Escape: clear selection and return home
- Tab: move through accessible controls
- Enter/Space on the visible panel toggle: hide or restore the HUD

### HUD controls

- Play/pause the simulation
- Increase/decrease the simulation speed
- Reset simulation time and speed
- Toggle in-scene labels
- Navigate to a body with previous/next controls or the body selector
- Return to the Sun-centered home view
- Hide or show the complete HUD and in-scene labels

The default simulation rate is intentionally slow (`0.1 simulated day/second`) so planetary movement is observable. Relative orbital-period ratios remain intact.

## Visualization scales

Real astronomical values are kept in the data model. Rendered distances and rendered body sizes are separate visualization mappings.

### Heliocentric distance

The default distance mapping is logarithmic:

```text
sceneDistance = distanceGain * log10(1 + distanceKm / distanceFloorKm)
```

The mapping preserves distance ordering and broad relative differences while allowing Mercury through Pluto to fit in the initial composition.

### Body radius

Body radius uses a separate compressed logarithmic mapping:

```text
sceneRadius = clamp(
  sunSceneRadius * (
    log1p(radiusKm) / log1p(sunRadiusKm)
  ) ** radiusCompression,
  minSceneRadius,
  maxSceneRadius
)
```

The Sun is self-illuminated and remains visually dominant. Planets and moons retain their real size ordering but are kept compact enough not to obscure neighboring orbits.

> This visualization uses real astronomical data. Orbital distances are compressed logarithmically and celestial-body sizes are adjusted for visibility. Rendered distances and rendered sizes therefore do not share one uniform physical scale.

## Data and sources

The dataset lives in `src/data/solarSystemData.ts` and is separated from rendering code. It contains 35 bodies: one star, eight planets, Pluto, and 25 moons.

Primary public sources:

- [NASA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/)
- [NASA/JPL Solar System Dynamics](https://ssd.jpl.nasa.gov/)
- [JPL Planetary Satellite Physical Parameters](https://ssd.jpl.nasa.gov/sats/phys_par/)

Units are explicit: kilometres for radii and moon distances, AU for heliocentric semi-major axes, degrees for inclinations/tilts, and days or hours for periods.

## Project structure

```text
src/
  main.ts
  styles.css
  data/
    types.ts
    solarSystemData.ts
    validate.ts
  core/
    CameraRig.ts
    CelestialBody.ts
    OrbitRenderer.ts
    ScaleManager.ts
    SimulationClock.ts
    SolarSystem.ts
    orbit.ts
  ui/
    AppController.ts
    ControlPanel.ts
    InfoPanel.ts
    Labels.ts
    hudVisibility.ts
    selectionModel.ts
    format.ts
```

- `data/`: astronomical facts, types, provenance, and validation.
- `core/`: scaling, orbital math, simulation clock, scene graph, camera, and disposal.
- `ui/`: selection, labels, information panels, controls, accessibility, and HUD visibility.

## Verification

The latest verification was performed in a real Chromium/SwiftShader WebGL runtime at desktop and mobile viewports.

- Typecheck: passed
- Production build: passed
- Vitest: **95/95 tests passed**
- Desktop and mobile selection checks: passed
- Earth/Venus identity regression: passed
- Pluto/Charon/Titan and other moon selection: passed
- Sun emissive rendering: passed
- Horizontal orbital composition: passed
- Hide/Show Panels keyboard restoration: passed
- Console and page errors: zero in the verification run
- Git working tree: clean

The final focused selection/size fix is recorded in commit `3228e23`; the Sun emissive fix is recorded in `fa6a673`.

## Known limitations

- The default UI prioritizes the logarithmic visualization mode; alternative scale modes are implemented as internal APIs rather than a complete user-facing scale-mode editor.
- Procedural star-field density and some advanced planetary surface detail remain intentionally lightweight for browser performance.
- The model is an educational visualization, not a high-precision ephemeris or physics engine.

## License

No license has been selected yet. Add an appropriate license before distributing this repository publicly.
