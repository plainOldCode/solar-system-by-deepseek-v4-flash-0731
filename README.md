# DS4 Solar System — Logarithmic Solar System Demo

Interactive 3D Solar System from the Sun to Pluto with major moons,
built on Vite + TypeScript + Three.js, using real NASA/JPL data.

> This repo is in bootstrap status. Full README (execution, data sources,
> scaling formulas, moon-selection criteria) is delivered in the final
> verification phase. See [DATA_PLAN.md](./DATA_PLAN.md) for the astronomical
> data contract.

## Quick start

```bash
npm install
npm run dev
```

Build / typecheck:

```bash
npm run dev        # dev server
npm run build      # tsc --noEmit + vite build
npm run preview    # preview the build
npm run typecheck  # tsc --noEmit only
```

## Layout

```
src/
  main.ts                 # entry (bootstrap stub)
  styles.css              # global styles
  data/solarSystemData.ts # astronomical data model + array
  core/                   # render/simulation/scale logic
    SolarSystem.ts
    CelestialBody.ts
    OrbitRenderer.ts
    ScaleManager.ts
    SimulationClock.ts
  ui/                     # HUD panels + labels
    ControlPanel.ts
    InfoPanel.ts
    Labels.ts
```
