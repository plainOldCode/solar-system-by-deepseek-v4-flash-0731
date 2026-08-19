/**
 * StarField — a procedural, deterministic background star field rendered as a
 * single THREE.Points cloud on a large sphere around the scene.
 *
 * Requirements (prompt §12/§16): black/very-dark space background with a
 * procedurally generated star field; work without external texture assets;
 * build geometry once (no per-frame allocation); respect the devicePixelRatio
 * cap (handled by the renderer); reduce star count on mobile devices.
 *
 * Positions are generated once from a small seeded PRNG so the field is
 * reproducible across runs — useful for tests and for keeping the visual
 * stable. Star size/colour vary slightly for depth.
 */

import * as THREE from "three";

/** Full-viewport star count (desktop). */
export const STAR_COUNT = 1500;
/** Reduced count for narrow/mobile viewports (§16: reduce star count on mobile). */
export const STAR_COUNT_MOBILE = 600;
/** Radius of the star-field shell (must sit outside the orbiting bodies but
 * inside the camera far plane; the far plane is 2000 and Pluto ~190, so 1450
 * keeps the field comfortably backgrounded and never intersected). */
export const STAR_FIELD_RADIUS = 1450;

/** Small seeded PRNG (mulberry32) so the star layout is deterministic. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface StarFieldOptions {
  count?: number;
  radius?: number;
  seed?: number;
}

export class StarField {
  readonly points: THREE.Points;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.PointsMaterial;
  private visible: boolean;

  constructor(opts: StarFieldOptions = {}) {
    const count = opts.count ?? STAR_COUNT;
    const radius = opts.radius ?? STAR_FIELD_RADIUS;
    const rand = mulberry32(opts.seed ?? 0x5eed);

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Uniform sampling on the shell of a sphere via normalised gaussian.
      // A sphere (not a disc) so the field fully surrounds the scene.
      let x = 0;
      let y = 0;
      let z = 0;
      let len = 0;
      while (len < 1e-3) {
        x = 2 * rand() - 1;
        y = 2 * rand() - 1;
        z = 2 * rand() - 1;
        len = Math.sqrt(x * x + y * y + z * z);
      }
      // Vary the shell radius slightly so distant stars read as spread out.
      const r = radius * (0.92 + rand() * 0.16);
      positions[i * 3] = (x / len) * r;
      positions[i * 3 + 1] = (y / len) * r;
      positions[i * 3 + 2] = (z / len) * r;

      // Slightly tinted whites/blues for a natural night-sky look.
      const brightness = 0.7 + rand() * 0.3;
      const tint = rand();
      if (tint < 0.08) color.setRGB(0.9 * brightness, 0.92 * brightness, 1.0 * brightness);
      else if (tint < 0.16) color.setRGB(1.0 * brightness, 0.95 * brightness, 0.85 * brightness);
      else color.setRGB(brightness, brightness, brightness * 0.98);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    this.material = new THREE.PointsMaterial({
      size: 1.6,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = "star-field";
    this.points.frustumCulled = false; // surrounds the whole scene; always visible
    this.visible = true;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.points.visible = visible;
  }

  /** Release GPU resources owned by the star field. */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
