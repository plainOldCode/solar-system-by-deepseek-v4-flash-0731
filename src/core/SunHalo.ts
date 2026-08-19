/**
 * SunHalo — a lightweight, reusable procedural glow for the Sun.
 *
 * The Sun is intentionally rendered with an unlit MeshBasicMaterial so it
 * reads as the brightest, self-illuminated object. To make it also read as an
 * actual *light source* we layer a soft radial-gradient halo sprite around the
 * disc. Everything here is procedural — a single small CanvasTexture built once
 * and shared as a module singleton — so there are no external image assets and
 * no per-frame allocations (the sprite is a static, camera-facing quad).
 *
 * Design constraints honoured:
 *  - `SolarSystem.buildViews` stays pure / headless (no DOM, no renderer): the
 *    halo is created by the `SolarSystem` runtime constructor, not by
 *    `buildViews`. In environments without a `document` the texture builder
 *    returns null and the sprite falls back to a plain warm material so tests
 *    and headless consumers still get a valid, sized sprite.
 *  - Restrained: the halo is a multiple of the Sun's own radius
 *    (`SUN_HALO_SCALE`) and is not additive-blown-out, so it frames the Sun
 *    without washing out planets or reaching the innermost orbits.
 *  - Scale-mode aware: `resizeSunHalo` tracks the live Sun radius on size-mode
 *    ("uniform" shrinks the Sun) and refreshScale calls.
 */

import * as THREE from "three";

/** Halo radius as a multiple of the Sun's scene radius. Mercury's default-mode
 * scene distance is ~5x the Sun radius, so 4.5 keeps the glow clear of the
 * innermost planets while still visibly surrounding the disc. */
export const SUN_HALO_SCALE = 4.5;

let haloTexture: THREE.CanvasTexture | null = null;
let haloTextureFailed = false;

/**
 * Lazily build one shared 256×256 radial-gradient CanvasTexture used by the Sun
 * halo. Module-level singleton → a single small texture serves every star.
 * Returns null when no DOM is available (pure/headless scene graph) or when
 * canvas creation fails, so the caller can degrade to a plain material.
 */
export function getHaloTexture(): THREE.CanvasTexture | null {
  if (haloTexture) return haloTexture;
  if (haloTextureFailed || typeof document === "undefined") return null;
  try {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      haloTextureFailed = true;
      return null;
    }
    // Warm-yellow sunlight core fading to transparent. Kept restrained so the
    // glow frames the disc without blow-out.
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.02,
      size / 2,
      size / 2,
      size / 2,
    );
    g.addColorStop(0.0, "rgba(255,244,214,0.85)");
    g.addColorStop(0.3, "rgba(255,221,85,0.40)");
    g.addColorStop(0.62, "rgba(255,170,60,0.14)");
    g.addColorStop(1.0, "rgba(255,150,50,0.0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    haloTexture = new THREE.CanvasTexture(canvas);
    haloTexture.colorSpace = THREE.SRGBColorSpace;
    return haloTexture;
  } catch {
    haloTextureFailed = true;
    return null;
  }
}

/**
 * Build the Sun's glow halo sprite, sized to `sunRadius`. Additive blending so
 * the glow accumulates like light; `depthWrite:false`/`fog:false` so it never
 * occludes or gets dimmed by the black space fog. Headless (no texture) it
 * still builds a valid warm sprite so tests remain DOM-free.
 */
export function createSunHalo(sunRadius: number): THREE.Sprite {
  const texture = getHaloTexture();
  const material = new THREE.SpriteMaterial({
    map: texture ?? undefined,
    color: 0xffffff,
    transparent: true,
    opacity: texture ? 0.9 : 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = "sun-halo";
  resizeSunHalo(sprite, sunRadius);
  return sprite;
}

/** Resize the halo to a new Sun radius (scale-mode changes). No allocation. */
export function resizeSunHalo(sprite: THREE.Sprite, sunRadius: number): void {
  const s = sunRadius * SUN_HALO_SCALE;
  sprite.scale.set(s, s, 1);
}
