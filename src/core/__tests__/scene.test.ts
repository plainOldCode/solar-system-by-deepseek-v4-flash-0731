import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { SolarSystem, updateBodyPositions } from "../SolarSystem";
import { ScaleManager, AU_KM } from "../ScaleManager";
import { SOLAR_SYSTEM } from "../../data/solarSystemData";
import type { CelestialBodyData } from "../../data/types";

/** Real km distance from the parent for a body. */
function semiMajorAxisKm(d: CelestialBodyData): number {
  if (d.semiMajorAxis === undefined) return 0;
  return d.semiMajorAxisUnit === "AU" ? d.semiMajorAxis * AU_KM : d.semiMajorAxis;
}

describe("SolarSystem.buildViews", () => {
  const scale = new ScaleManager();
  const views = SolarSystem.buildViews(scale);

  it("creates every body: sun + 34 (8 planets + Pluto + 25 moons)", () => {
    expect(views.byId.size).toBe(SOLAR_SYSTEM.length); // 35
    expect(views.bodies).toHaveLength(34);
    expect(views.sun.data.id).toBe("sun");
    for (const d of SOLAR_SYSTEM) {
      expect(views.byId.get(d.id)).toBeDefined();
    }
  });

  it("parents moons under their planet's group (Sun → planet → moon)", () => {
    const sunGroup = views.sun.group;
    const jupiter = views.byId.get("jupiter")!;
    for (const moonId of ["io", "europa", "ganymede", "callisto"]) {
      expect(views.byId.get(moonId)!.group.parent).toBe(jupiter.group);
    }
    // Heliocentric bodies (planet/dwarf) attach directly to the scene root,
    // which sits at the origin with the Sun — same centre.
    expect(views.byId.get("mercury")!.group.parent).toBe(views.root);
    expect(sunGroup.parent).toBe(views.root);
    expect(views.byId.get("moon")!.group.parent).toBe(views.byId.get("earth")!.group);
  });

  it("draws one orbit line per non-sun body, parent-local", () => {
    expect(views.lines).toHaveLength(34);
    const earthLine = views.lines.find((l) => l.userData.bodyId === "earth")!;
    expect(earthLine.parent).toBe(views.root);
    const moonLine = views.lines.find((l) => l.userData.bodyId === "moon")!;
    expect(moonLine.parent).toBe(views.byId.get("earth")!.group);
  });

  it("places bodies at their log-scaled orbit radius", () => {
    updateBodyPositions(views, 123.45);
    for (const body of views.bodies) {
      const km = semiMajorAxisKm(body.data);
      const expectedR = scale.distance(km);
      expect(body.group.position.length()).toBeCloseTo(expectedR, 4);
    }
  });

  it("positions match the drawn orbit ring exactly", () => {
    updateBodyPositions(views, 7);
    for (const line of views.lines) {
      const attr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      const ringR = Math.hypot(attr.getX(0), attr.getY(0), attr.getZ(0));
      const body = views.byId.get(line.userData.bodyId as string)!;
      expect(body.group.position.length()).toBeCloseTo(ringR, 4);
    }
  });

  it("is deterministic across independent constructions", () => {
    const a = views;
    const b = SolarSystem.buildViews(new ScaleManager());
    updateBodyPositions(a, 42);
    updateBodyPositions(b, 42);
    for (const id of ["earth", "io", "titan", "pluto"]) {
      expect(a.byId.get(id)!.group.position.equals(b.byId.get(id)!.group.position)).toBe(true);
    }
  });

  it("carries moons along with their planet via parent-child world transforms", () => {
    updateBodyPositions(views, 31);
    views.root.updateMatrixWorld(true);
    const earth = views.byId.get("earth")!;
    const moon = views.byId.get("moon")!;
    const planetWorld = new THREE.Vector3();
    const moonWorld = new THREE.Vector3();
    earth.group.getWorldPosition(planetWorld);
    moon.group.getWorldPosition(moonWorld);
    const offset = moonWorld.distanceTo(planetWorld);
    expect(offset).toBeGreaterThan(0);
    // The world offset from the planet centre equals the moon's local position
    // magnitude (its planetocentric distance).
    expect(offset).toBeCloseTo(moon.group.position.length(), 4);
  });
});
