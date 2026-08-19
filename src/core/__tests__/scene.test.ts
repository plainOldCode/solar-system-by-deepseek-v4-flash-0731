import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  SolarSystem,
  updateBodyPositions,
  refreshViews,
  setOrbitsVisibility,
  setMoonsVisibility,
  setMoonEmphasis,
  applySelectedEmphasis,
} from "../SolarSystem";
import {
  ORBIT_LINE_OPACITY,
  ORBIT_COLOR,
  MOON_ORBIT_FAINT_OPACITY,
  MOON_ORBIT_EMPHASIZED_OPACITY,
  SELECTED_ORBIT_OPACITY,
  SELECTED_ORBIT_COLOR,
  UNSELECTED_ORBIT_OPACITY,
} from "../OrbitRenderer";
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
    const sunMat = views.sun.mesh.material as THREE.MeshBasicMaterial;
    expect(sunMat.color.getHexString()).toBe("ffdd55");
    // fog:false — the black space fog must not dim the self-lit Sun.
    expect(sunMat.fog).toBe(false);
    for (const body of views.bodies) {
      expect(body.mesh.material).not.toBeInstanceOf(THREE.MeshBasicMaterial);
    }
    // A representative lit body still has a shading-aware Lambert material.
    expect(views.byId.get("earth")!.mesh.material).toBeInstanceOf(
      THREE.MeshLambertMaterial,
    );
  });

  it("renders a true ellipse whose mean scene radius equals the scaled semi-major axis", () => {
    updateBodyPositions(views, 123.45);
    for (const body of views.bodies) {
      const line = views.lines.find(
        (l) => l.userData.bodyId === body.data.id,
      )!;
      const attr = line.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      let maxR = -Infinity;
      let minR = Infinity;
      for (let i = 0; i < attr.count; i++) {
        const r = Math.hypot(attr.getX(i), attr.getY(i), attr.getZ(i));
        if (r > maxR) maxR = r;
        if (r < minR) minR = r;
      }
      // (apoapsis + periapsis)/2 is the semi-major axis = the body's scaled
      // ring radius (mode-aware). Eccentric orbits span more than a circle.
      expect((maxR + minR) / 2).toBeCloseTo(body.ringSceneRadius, 3);
    }
  });

  it("positions match the drawn orbit path exactly (body == guide vertex at sample times)", () => {
    updateBodyPositions(views, 0); // t=0 is the geometry's first sample vertex
    for (const line of views.lines) {
      const attr = line.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      const body = views.byId.get(line.userData.bodyId as string)!;
      expect(body.group.position.x).toBeCloseTo(attr.getX(0), 4);
      expect(body.group.position.y).toBeCloseTo(attr.getY(0), 4);
      expect(body.group.position.z).toBeCloseTo(attr.getZ(0), 4);
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

function expectBodiesOnGuides(views: SolarSystemViewsLike): void {
  for (const line of views.lines) {
    const body = views.byId.get(line.userData.bodyId as string);
    if (!body) continue;
    const attr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    const bp = body.group.position;
    const r = bp.length() || 1;
    let best = Infinity;
    for (let i = 0; i < attr.count; i++) {
      const d = Math.hypot(
        attr.getX(i) - bp.x,
        attr.getY(i) - bp.y,
        attr.getZ(i) - bp.z,
      );
      if (d < best) best = d;
    }
    // The body rides on the guide polyline (nearest vertex within tessellation).
    expect(best / r).toBeLessThan(0.05);
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
    expectBodiesOnGuides(views);
  });

  it("focus-mode refresh keeps moon orbits local and compact", () => {
    const scale = new ScaleManager();
    const views = SolarSystem.buildViews(scale);
    updateBodyPositions(views, 20);
    scale.setDistanceMode("focus");
    const jupiter = SOLAR_SYSTEM.find((b) => b.id === "jupiter")!;
    scale.setFocusKm(semiMajorAxisKm(jupiter));
    refreshViews(views, 20);
    expectBodiesOnGuides(views);
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

  it("setMoonEmphasis fades all moon orbits and emphasizes only the focused system", () => {
    const views = SolarSystem.buildViews(new ScaleManager());
    // Focus Jupiter: its moons brighten, everyone else's stay faint.
    setMoonEmphasis(views, "jupiter");
    for (const line of views.lines) {
      const owner = views.byId.get(line.userData.bodyId as string)!;
      if (owner.data.type !== "moon") continue;
      const op = (line.material as THREE.LineBasicMaterial).opacity;
      expect(op).toBe(
        owner.data.parentId === "jupiter"
          ? MOON_ORBIT_EMPHASIZED_OPACITY
          : MOON_ORBIT_FAINT_OPACITY,
      );
    }
    // Clearing focus drops every moon orbit back to faint.
    setMoonEmphasis(views, null);
    for (const line of views.lines) {
      const owner = views.byId.get(line.userData.bodyId as string)!;
      if (owner.data.type === "moon") {
        expect((line.material as THREE.LineBasicMaterial).opacity).toBe(
          MOON_ORBIT_FAINT_OPACITY,
        );
      }
    }
  });

  it("setMoonEmphasis never touches heliocentric (planet/dwarf) line opacity", () => {
    const views = SolarSystem.buildViews(new ScaleManager());
    setMoonEmphasis(views, "earth");
    const earthLine = views.lines.find((l) => l.userData.bodyId === "earth")!;
    const plutoLine = views.lines.find((l) => l.userData.bodyId === "pluto")!;
    // Planet/dwarf lines keep their original guide opacity (not faint/emphasized).
    expect((earthLine.material as THREE.LineBasicMaterial).opacity).toBe(ORBIT_LINE_OPACITY);
    expect((plutoLine.material as THREE.LineBasicMaterial).opacity).toBe(ORBIT_LINE_OPACITY);
  });
});

describe("true-ellipse orbit geometry", () => {
  /** Periapsis & apoapsis scene radii of an orbit guide (in its local frame). */
  function orbitRadii(line: THREE.Line): { maxR: number; minR: number } {
    const attr = line.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    let maxR = -Infinity;
    let minR = Infinity;
    for (let i = 0; i < attr.count; i++) {
      const r = Math.hypot(attr.getX(i), attr.getY(i), attr.getZ(i));
      if (r > maxR) maxR = r;
      if (r < minR) minR = r;
    }
    return { maxR, minR };
  }

  it("preserves real eccentricity: implied e from apo/peri ratio matches the dataset", () => {
    const views = SolarSystem.buildViews(new ScaleManager());
    // Linear scene scaling preserves eccentricity exactly (focus stays at the
    // parent), so apoapsis/periapsis must recover the real e via (1+e)/(1-e).
    const cases = [
      { id: "mercury", e: 0.2056 },
      { id: "pluto", e: 0.2488 },
      { id: "mars", e: 0.0934 },
      { id: "earth", e: 0.0167 },
    ];
    for (const c of cases) {
      const line = views.lines.find((l) => l.userData.bodyId === c.id)!;
      const { maxR, minR } = orbitRadii(line);
      const ratio = maxR / minR; // == (1+e)/(1−e)
      const implied = (ratio - 1) / (ratio + 1);
      expect(implied).toBeCloseTo(c.e, 3);
    }
  });

  it("tilts inclined orbits out of the reference plane (Pluto i=17.16°, Triton i=156.9°)", () => {
    const views = SolarSystem.buildViews(new ScaleManager());
    const measure = (id: string) => {
      const line = views.lines.find((l) => l.userData.bodyId === id)!;
      const attr = line.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      const { maxR, minR } = orbitRadii(line);
      const semiMajor = (maxR + minR) / 2;
      let maxOutOfPlane = 0;
      // In the local orbit frame the reference plane is X–Y (z=0 for i=0);
      // inclination lifts points out along z by k·a·√(1−e²)·sin(i).
      for (let i = 0; i < attr.count; i++) {
        maxOutOfPlane = Math.max(maxOutOfPlane, Math.abs(attr.getZ(i)));
      }
      return { maxOutOfPlane, semiMajor };
    };

    const pluto = SOLAR_SYSTEM.find((b) => b.id === "pluto")!;
    const p = measure("pluto");
    const ePluto = pluto.eccentricity ?? 0;
    const iPluto = pluto.inclinationDeg ?? 0;
    expect(p.maxOutOfPlane / p.semiMajor).toBeCloseTo(
      Math.sqrt(1 - ePluto * ePluto) * Math.sin((iPluto * Math.PI) / 180),
      2,
    );

    const triton = SOLAR_SYSTEM.find((b) => b.id === "triton")!;
    const t = measure("triton");
    const eTriton = triton.eccentricity ?? 0;
    const iTriton = triton.inclinationDeg ?? 0;
    expect(t.maxOutOfPlane / t.semiMajor).toBeCloseTo(
      Math.sqrt(1 - eTriton * eTriton) * Math.sin((iTriton * Math.PI) / 180),
      2,
    );

    // Earth's inclination is 0.0°, so its orbit must stay in the reference plane.
    const e = measure("earth");
    expect(e.maxOutOfPlane).toBeLessThan(e.semiMajor * 1e-6);
  });
});

describe("selection orbit highlighting", () => {
  const mat = (line: THREE.Line) => line.material as THREE.LineBasicMaterial;

  it("highlights the selected body's orbit, reveals its moons, and dims the rest", () => {
    const views = SolarSystem.buildViews(new ScaleManager());
    applySelectedEmphasis(views, "jupiter");
    for (const line of views.lines) {
      const owner = views.byId.get(line.userData.bodyId as string)!;
      if (owner.data.id === "jupiter") {
        expect(mat(line).opacity).toBe(SELECTED_ORBIT_OPACITY);
        expect(mat(line).color.getHexString()).toBe(
          SELECTED_ORBIT_COLOR.slice(1),
        );
      } else if (owner.data.type === "moon" && owner.data.parentId === "jupiter") {
        expect(mat(line).opacity).toBe(MOON_ORBIT_EMPHASIZED_OPACITY);
      } else if (owner.data.type === "moon") {
        expect(mat(line).opacity).toBe(MOON_ORBIT_FAINT_OPACITY);
      } else {
        expect(mat(line).opacity).toBe(UNSELECTED_ORBIT_OPACITY);
        expect(mat(line).color.getHexString()).toBe(ORBIT_COLOR.slice(1));
      }
    }
  });

  it("handles a selection with no applicable orbit (the Sun) gracefully", () => {
    const views = SolarSystem.buildViews(new ScaleManager());
    applySelectedEmphasis(views, "jupiter"); // establish a highlight first
    applySelectedEmphasis(views, "sun"); // Sun has no orbit line → restore defaults
    for (const line of views.lines) {
      const owner = views.byId.get(line.userData.bodyId as string)!;
      const m = mat(line);
      expect(m.opacity).toBe(
        owner.data.type === "moon"
          ? MOON_ORBIT_FAINT_OPACITY
          : ORBIT_LINE_OPACITY,
      );
      expect(m.color.getHexString()).toBe(ORBIT_COLOR.slice(1));
    }
  });

  it("clearing the selection restores every guide to its default opacity", () => {
    const views = SolarSystem.buildViews(new ScaleManager());
    applySelectedEmphasis(views, "mars");
    applySelectedEmphasis(views, null);
    for (const line of views.lines) {
      const owner = views.byId.get(line.userData.bodyId as string)!;
      expect(mat(line).opacity).toBe(
        owner.data.type === "moon"
          ? MOON_ORBIT_FAINT_OPACITY
          : ORBIT_LINE_OPACITY,
      );
    }
  });

  it("highlighting a moon brightens its siblings and dims its parent planet", () => {
    const views = SolarSystem.buildViews(new ScaleManager());
    applySelectedEmphasis(views, "io");
    for (const line of views.lines) {
      const owner = views.byId.get(line.userData.bodyId as string)!;
      if (owner.data.id === "io") {
        expect(mat(line).opacity).toBe(SELECTED_ORBIT_OPACITY);
      } else if (owner.data.type === "moon" && owner.data.parentId === "jupiter") {
        expect(mat(line).opacity).toBe(MOON_ORBIT_EMPHASIZED_OPACITY);
      } else if (owner.data.type === "moon") {
        expect(mat(line).opacity).toBe(MOON_ORBIT_FAINT_OPACITY);
      } else {
        // Jupiter's own (helio) line dims like every other non-selected body.
        expect(mat(line).opacity).toBe(UNSELECTED_ORBIT_OPACITY);
      }
    }
  });
});
