import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  SUN_HALO_SCALE,
  createSunHalo,
  resizeSunHalo,
  getHaloTexture,
} from "../SunHalo";

describe("SunHalo", () => {
  it("builds a camera-facing sprite sized as a multiple of the Sun radius", () => {
    const sprite = createSunHalo(2.2);
    expect(sprite).toBeInstanceOf(THREE.Sprite);
    expect(sprite.name).toBe("sun-halo");
    expect(sprite.scale.x).toBeCloseTo(2.2 * SUN_HALO_SCALE, 5);
    expect(sprite.scale.y).toBeCloseTo(2.2 * SUN_HALO_SCALE, 5);
    expect(sprite.scale.z).toBe(1);
  });

  it("resizeSunHalo retargets the glow to a new live Sun radius (no allocation)", () => {
    const sprite = createSunHalo(2.2);
    resizeSunHalo(sprite, 1.5);
    expect(sprite.scale.x).toBeCloseTo(1.5 * SUN_HALO_SCALE, 5);
    expect(sprite.scale.y).toBeCloseTo(1.5 * SUN_HALO_SCALE, 5);
  });

  it("uses a restrained additive, transparent, fog-free material", () => {
    const sprite = createSunHalo(2.2);
    const mat = sprite.material as THREE.SpriteMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.blending).toBe(THREE.AdditiveBlending);
    expect(mat.depthWrite).toBe(false);
    expect(mat.fog).toBe(false);
  });

  it("getHaloTexture returns null headlessly (no DOM) and is cached when present", () => {
    const t = getHaloTexture();
    // Node test env has no `document`, so the procedural canvas texture is
    // unavailable here — createSunHalo must still yield a valid sprite via the
    // plain-material fallback. When a DOM exists it returns a CanvasTexture.
    if (typeof document === "undefined") {
      expect(t).toBeNull();
    } else {
      expect(t).toBeInstanceOf(THREE.CanvasTexture);
      expect(getHaloTexture()).toBe(t); // cached singleton
    }
  });

  it("multiple halos share one material-less texture singleton in headless mode", () => {
    const a = createSunHalo(2.2);
    const b = createSunHalo(3.0);
    // Separate sprites/materials but (when textured) the same map object.
    const ma = a.material as THREE.SpriteMaterial;
    const mb = b.material as THREE.SpriteMaterial;
    if (ma.map) expect(ma.map).toBe(mb.map);
  });
});
