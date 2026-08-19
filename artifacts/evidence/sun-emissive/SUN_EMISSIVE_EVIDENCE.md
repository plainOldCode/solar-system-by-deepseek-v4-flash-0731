# Sun Emissive Fix — Evidence

Task t_0dc9e67e: *Make the Sun visibly emissive and bright.*

## Root cause

In `src/core/CelestialBody.ts`, every body — including the Sun — was built with a
`THREE.MeshLambertMaterial` that depends on the scene lights. The scene's Sun
`PointLight` sits at the origin (the Sun's own centre), so the Sun sphere's outward
normals never face the light; it received only the faint top‑down `DirectionalLight`
and dim blue `AmbientLight`. Result: the Sun rendered as a dark, dull charcoal/gray
body instead of the brightest emissive star.

## Fix (focused)

`CelestialBody.buildMesh` now uses a self-illuminated (unlit) `MeshBasicMaterial`
for `type === "star"` (the Sun), while every other body keeps its
`MeshLambertMaterial`. The scene lights are untouched, so the PointLight continues
to shape correct daylight on planets/moons.

## Reproduction & verification (real headless Chromium + WebGL, SwiftShader)

Script: `artifacts/evidence/sun-emissive/verify-sun.mjs` (Playwright/Chromium).
Before = rebuilt from the pre-fix commit (Lambert Sun); After = this fix.
ArrowDown on an empty selection selects + zooms the Sun (order starts at "sun").
Both viewports selected `태양`/Sun. **Zero console errors, zero pageerrors** in
all four runs.

| Viewport | Before | After | Selection | Console errors |
|---|---|---|---|---|
| Desktop 1280×800 | charcoal/dark, not the brightest | bright warm-yellow, biggest & brightest | 태양 | 0 |
| Mobile 390×844 | dark | bright warm-yellow | 태양 | 0 |

- `before/desktop-sun-focused.png` — Sun is dark charcoal-gray-green (bug reproduced).
- `after/desktop-sun-focused.png` — Sun is bright warm-yellow and the dominant
  bright object; visible planets keep lit appearance, none washed out.
- `after/mobile-sun-focused.png` — Sun bright at mobile, planets retain detail.

## Gates

- `npm run typecheck` — exit 0
- `npm test` — 92/92 passed (6 files), incl. new regression test asserting the Sun
  uses `MeshBasicMaterial` (#ffdd55) and every other body stays non-basic/lit Lambert
- `npm run build` — exit 0 (tsc --noEmit + vite build)

## Commit
`git commit` of `src/core/CelestialBody.ts`, `src/core/__tests__/scene.test.ts`, and
this `artifacts/evidence/sun-emissive/` folder.
