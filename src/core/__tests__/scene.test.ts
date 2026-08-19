import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  SolarSystem,
  updateBodyPositions,
  refreshViews,
  setOrbitsVisibility,
  setMoonsVisibility,
} from "../SolarSystem";
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

  it("renders the Sun with a self-illuminated (unlit) material so it is visibly brightest", () => {
    // Regression: the dark-Sun bug. Sun must be emissive/self-lit — not a lit
    // Lambert that depends on scene lights — while planets/moons keep a lit
    // material so the PointLight still illumines them.
    expect(views.sun.mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect((views.sun.mesh.material as THREE.MeshBasicMaterial).color.getHexString()).toBe("ffdd55");
    for (const body of views.bodies) {
      expect(body.mesh.material).not.toBeInstanceOf(THREE.MeshBasicMaterial);
    }
    // A representative lit body still has a shading-aware Lambert material.
    expect(views.byId.get("earth")!.mesh.material).toBeInstanceOf(
      THREE.MeshLambertMaterial,
    );
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

  it("default orbital plane is horizontal (XZ), not edge-on vertical (XY)", () => {
    // Regression for the "default composition must read as a familiar
    // horizontal, plane-like system" requirement. The pure orbital math emits
    // orbits in the X–Y plane; SolarSystem reorients the root −90° about X so
    // the rendered plane is the horizontal X–Z plane. Earth's inclination is
    // 0.0°, so its orbit ring must be essentially flat and span both X and Z
    // in world space (not sit in a vertical X–Y disc).
    const v = SolarSystem.buildViews(new ScaleManager());
    updateBodyPositions(v, 0);
    v.root.updateMatrixWorld(true);
    const earthLine = v.lines.find((l) => l.userData.bodyId === "earth")!;
    const attr = earthLine.geometry.getAttribute("position") as THREE.BufferAttribute;
    const p = new THREE.Vector3();
    let maxAbsY = 0;
    let maxAbsX = 0;
    let maxAbsZ = 0;
    for (let i = 0; i < attr.count; i++) {
      p.set(attr.getX(i), attr.getY(i), attr.getZ(i));
      earthLine.localToWorld(p); // applies the root −90°-about-X reorientation
      maxAbsY = Math.max(maxAbsY, Math.abs(p.y));
      maxAbsX = Math.max(maxAbsX, Math.abs(p.x));
      maxAbsZ = Math.max(maxAbsZ, Math.abs(p.z));
    }
    const ringR = Math.hypot(attr.getX(0), attr.getY(0), attr.getZ(0));
    // Horizontal: negligible vertical spread, real spread in X and Z.
    expect(maxAbsY).toBeLessThan(ringR * 0.05);
    expect(maxAbsX).toBeGreaterThan(ringR * 0.5);
    expect(maxAbsZ).toBeGreaterThan(ringR * 0.5);
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

function expectBodiesOnRings(views: SolarSystemViewsLike): void {
  for (const line of views.lines) {
    const attr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    const ringR = Math.hypot(attr.getX(0), attr.getY(0), attr.getZ(0));
    const body = views.byId.get(line.userData.bodyId as string);
    expect(body!.group.position.length()).toBeCloseTo(ringR, 4);
  }
}

/** Structural subset of SolarSystemViews used by refreshViews + visibility utils. */
type SolarSystemViewsLike = ReturnType<typeof SolarSystem.buildViews>;

describe("SolarSystem scale refresh + visibility toggles", () => {
  it("refreshViews keeps bodies on their rings after a distance-mode change", () => {
    const scale = new ScaleManager();
    const views = SolarSystem.buildViews(scale);
    updateBodyPositions(views, 10);
    scale.setDistanceMode("linear");
    refreshViews(views, 10);
    expectBodiesOnRings(views);
  });

  it("focus-mode refresh keeps moon orbits local and compact", () => {
    const scale = new ScaleManager();
    const views = SolarSystem.buildViews(scale);
    updateBodyPositions(views, 20);
    scale.setDistanceMode("focus");
    const jupiter = SOLAR_SYSTEM.find((b) => b.id === "jupiter")!;
    scale.setFocusKm(semiMajorAxisKm(jupiter));
    refreshViews(views, 20);
    expectBodiesOnRings(views);
    const earth = views.byId.get("earth")!;
    const moon = views.byId.get("moon")!;
    expect(moon.group.position.length()).toBeLessThan(earth.group.position.length() * 0.5);
  });

  it("setOrbitsVisibility hides and restores every orbit line", () => {
    const views = SolarSystem.buildViews(new ScaleManager());
    setOrbitsVisibility(views, false);
    for (const line of views.lines) expect(line.visible).toBe(false);
    setOrbitsVisibility(views, true);
    for (const line of views.lines) expect(line.visible).toBe(true);
  });

  it("setMoonsVisibility hides moon bodies + moon lines only", () => {
    const views = SolarSystem.buildViews(new ScaleManager());
    setMoonsVisibility(views, false);
    for (const body of views.bodies) {
      if (body.data.type === "moon") {
        expect(body.group.visible).toBe(false);
      } else {
        expect(body.group.visible).toBe(true);
      }
    }
    for (const line of views.lines) {
      const owner = views.byId.get(line.userData.bodyId as string)!;
      expect(line.visible).toBe(owner.data.type !== "moon");
    }
    setMoonsVisibility(views, true);
    for (const body of views.bodies) expect(body.group.visible).toBe(true);
  });
});
