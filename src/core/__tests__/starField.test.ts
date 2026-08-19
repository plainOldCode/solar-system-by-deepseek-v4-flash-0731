import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  StarField,
  STAR_COUNT,
  STAR_COUNT_MOBILE,
  STAR_FIELD_RADIUS,
} from "../StarField";

function positions(f: StarField): THREE.BufferAttribute {
  const attr = f.points.geometry.getAttribute("position") as THREE.BufferAttribute;
  if (!attr) throw new Error("no position attribute");
  return attr;
}

describe("StarField", () => {
  it("builds exactly the requested number of star points", () => {
    const f = new StarField({ count: 137, radius: 100, seed: 7 });
    expect(positions(f).count).toBe(137);
    expect(f.points.geometry.getAttribute("color")?.count).toBe(137);
  });

  it("is deterministic across instances with the same seed", () => {
    const a = new StarField({ count: 80, radius: 20, seed: 42 });
    const b = new StarField({ count: 80, radius: 20, seed: 42 });
    const pa = positions(a);
    const pb = positions(b);
    // Direct array equality of the position float arrays.
    expect(Array.from(pa.array)).toEqual(Array.from(pb.array));
  });

  it("places points on a shell well outside the orbiting bodies but inside the far plane", () => {
    const f = new StarField({ count: 300, radius: 50, seed: 3 });
    const pos = positions(f);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const r = Math.sqrt(x * x + y * y + z * z);
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThan(50 * 0.9);
      expect(r).toBeLessThan(50 * 1.15);
    }
  });

  it("surface radius defaults inside the app camera far plane and beyond the outer orbits", () => {
    expect(STAR_FIELD_RADIUS).toBeLessThan(2000); // app camera far plane is 2000
    expect(STAR_FIELD_RADIUS).toBeGreaterThan(500); // well beyond Pluto ~190
  });

  it("toggles visibility via setVisible / isVisible", () => {
    const f = new StarField({ count: 10 });
    expect(f.points.visible).toBe(true);
    expect(f.isVisible).toBe(true);
    f.setVisible(false);
    expect(f.isVisible).toBe(false);
    expect(f.points.visible).toBe(false);
    f.setVisible(true);
    expect(f.points.visible).toBe(true);
  });

  it("exposes distinct desktop vs mobile counts", () => {
    expect(STAR_COUNT_MOBILE).toBeLessThan(STAR_COUNT);
    expect(STAR_COUNT).toBeGreaterThan(0);
  });
});
