# Sun Light + Glow Improvement — Evidence

Task `t_31c0ba6f`: make the Sun visibly read as a luminous light source with a
restrained procedural halo/glow while planets and moons receive believable
illumination — in `/Users/m2max/ds4-solar-system` only.

## Approach (focused, performant)

1. **Procedural halo sprite** (`src/core/SunHalo.ts`) — a single 256×256 radial
   gradient is drawn once on a canvas and cached as a `THREE.CanvasTexture`
   module singleton (no external image assets, no per-frame allocation). A
   camera-facing `THREE.Sprite` using it wraps the Sun disc with `AdditiveBlending`
   (`depthWrite:false`, `fog:false`), so the glow accumulates like light around
   the disc without a hard edge or blow-out. Halo radius = `SUN_HALO_SCALE` (4.5)
   × live Sun radius, so it stays clear of the innermost planets (~5× the Sun
   radius away in default mode) — restrained.
   - Created by the runtime `SolarSystem` constructor (not the pure
     `buildViews`), keeping the scene graph headless-testable. In no-DOM
     environments it degrades to a plain warm material. Tracks the Sun's live
     radius across size-mode changes via `resizeSunHalo` in `refreshScale`.
   - Disposed with the renderer.

2. **Keep the Sun visibly brightest** (`CelestialBody`) — the Sun keeps its
   self-illuminated `MeshBasicMaterial` (#ffdd55) and now sets `fog:false` so
   the black space fog (camera ~50 units out, fog band 40→90) no longer dims it
   toward black. Every other body keeps its lit `MeshLambertMaterial`.

3. **Believable sunlight** (`SolarSystem.addLights`) — the Sun's `PointLight`
   is warmed from pure white to `0xfff1c8` so lit planet/moon surfaces read as
   actual sunlight rather than neutral white. Ambient + directional fill,
   horizontal composition, and scale modes are untouched. No post-processing.

Preserved: bright self-lit Sun, horizontal composition, planet colors, mobile
performance (one extra static transparent quad), selection/focus, no external
image assets.

## Verification (real Chromium / SwiftShader WebGL)

Harness: `artifacts/evidence/sun-glow/verify-sun-glow.mjs` (Playwright headless
Chromium, `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`).
Note: SwiftShader clears the present drawing buffer, so `readPixels` returned
zeros; measurements are taken from decoded screenshots of the actual rendered
output (`compare.mjs` / PNG decode, RGBA8).

| Viewport | Renderer | Before edge-halo lum | After edge-halo lum | Δ |
|---|---|---|---|---|
| Desktop 1280×800 | ANGLE Vulkan SwiftShader | 0.1 (hard-edged disc) | 3.6 | +3.5 |
| Mobile 390×844 | ANGLE Vulkan SwiftShader | 199.5 | 218.4 | +18.9 |

`edge-halo lum` = average luminance in the annulus 1.15–1.6× the Sun disc radius
(just outside the solid disc — where a glow hug lives). Desktop is the clean
discriminator: the Sun went from a hard-edged circle to having a visible,
restrained soft glow. Mobile rises too. Planets remain lit and not washed out:

| Viewport | nonBlack% (home) | planets-lit% (home) | console/page/network errors |
|---|---|---|---|
| Desktop 1280×800 | 18.4 | 5.47 | 0 |
| Mobile 390×844 | 29.9 | 6.80 | 0 |

Screenshots (before = pre-change baseline built from the committed state;
after = this change):
- `before/desktop-1280x800-home.png` vs `after/desktop-1280x800-home.png`
- `before/mobile-390x844-home.png` vs `after/mobile-390x844-home.png`
- `after/desktop-1280x800-sun-focused.png`, `after/mobile-390x844-sun-focused.png`

Visual inspection (desktop + mobile): Sun is a bright warm-yellow disc with a
soft diffused glow fading into space; planets show believable sun-side shading,
none washed out or underexposed; composition and UI unchanged.

## Gates

- `npm run typecheck` — PASS (tsc --noEmit, exit 0)
- `npm run test` — PASS, 139/139 Vitest (8 files) — incl. new `sunhalo.test.ts`
  and the extended Sun-material regression (`fog:false`) in `scene.test.ts`
- `npm run build` — PASS (vite production build, exit 0)
- Browser: 4/4 runs (desktop+mobile, home+sun-focused) **zero** console/page/
  network errors

## Commit
Focused commit of `src/core/SunHalo.ts`, `src/core/SolarSystem.ts`,
`src/core/CelestialBody.ts`, `src/core/__tests__/sunhalo.test.ts`,
`src/core/__tests__/scene.test.ts`, and this `artifacts/evidence/sun-glow/`
folder.
