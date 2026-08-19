import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  SELECTION_ORDER,
  nextSelection,
  prevSelection,
  bodyIdFromIntersects,
  resolveBodyPick,
  focusDistanceFor,
} from "../selectionModel";
import {
  formatBodyInfo,
  directMoonsOf,
  bodyAlt,
  TYPE_LABEL_KO,
  formatSimDays,
} from "../format";
import { labelText, secondaryLabelText, shouldShowLabel } from "../Labels";
import { SOLAR_SYSTEM } from "../../data/solarSystemData";
import { ScaleManager } from "../../core/ScaleManager";

const jupiter = SOLAR_SYSTEM.find((b) => b.id === "jupiter")!;
const io = SOLAR_SYSTEM.find((b) => b.id === "io")!;
const sun = SOLAR_SYSTEM.find((b) => b.id === "sun")!;
const pluto = SOLAR_SYSTEM.find((b) => b.id === "pluto")!;

describe("selectionModel navigation", () => {
  it("starts navigation at the first body from null", () => {
    expect(nextSelection(null)).toBe(SELECTION_ORDER[0]);
    expect(prevSelection(null)).toBe(SELECTION_ORDER[SELECTION_ORDER.length - 1]);
  });

  it("next() wraps forward and prev() wraps backward", () => {
    expect(nextSelection("sun")).toBe(SELECTION_ORDER[1]);
    const last = SELECTION_ORDER[SELECTION_ORDER.length - 1];
    expect(nextSelection(last)).toBe(SELECTION_ORDER[0]);
    expect(prevSelection(SELECTION_ORDER[0])).toBe(last);
    expect(prevSelection("jupiter")).toBe(
      SELECTION_ORDER[SELECTION_ORDER.indexOf("jupiter") - 1],
    );
  });

  it("covers every body id exactly once (35 unique)", () => {
    expect(SELECTION_ORDER.length).toBe(SOLAR_SYSTEM.length);
    expect(new Set(SELECTION_ORDER).size).toBe(SOLAR_SYSTEM.length);
  });

  it("treats an unknown id as 'not yet navigated'", () => {
    expect(nextSelection("not-a-body")).toBe(SELECTION_ORDER[0]);
  });
});

describe("bodyIdFromIntersects", () => {
  it("resolves a body id on the hit object itself", () => {
    const mesh = new THREE.Mesh();
    mesh.userData.bodyId = "earth";
    expect(bodyIdFromIntersects([{ object: mesh }])).toBe("earth");
  });

  it("resolves through the parent chain (mesh/moon orbit line under a group)", () => {
    const group = new THREE.Group();
    group.userData.bodyId = "titan";
    const child = new THREE.Mesh();
    group.add(child);
    expect(bodyIdFromIntersects([{ object: child }])).toBe("titan");
  });

  it("returns null when nothing resolves to a body", () => {
    const plain = new THREE.Mesh();
    expect(bodyIdFromIntersects([{ object: plain }])).toBeNull();
    expect(bodyIdFromIntersects([])).toBeNull();
  });
});

describe("resolveBodyPick", () => {
  it("lets a nearer orbit-line hit NOT shadow a farther body sphere (Earth vs Venus)", () => {
    const earthMesh = new THREE.Mesh();
    earthMesh.userData.bodyId = "earth";
    const venusLine = new THREE.Line();
    venusLine.userData.bodyId = "venus";
    // Distance-sorted merged list would put the Venus line first (nearest),
    // which is exactly how "click Earth -> select Venus" arose. resolveBodyPick
    // instead resolves body meshes first so Earth's sphere wins.
    const meshHits = [{ object: earthMesh, distance: 56.9 } as any];
    const lineHits = [{ object: venusLine, distance: 55.8 } as any];
    expect(resolveBodyPick(meshHits, lineHits)).toBe("earth");
  });

  it("falls back to orbit-line hits when no body sphere is hit", () => {
    const venusLine = new THREE.Line();
    venusLine.userData.bodyId = "venus";
    expect(resolveBodyPick([], [{ object: venusLine }])).toBe("venus");
    expect(resolveBodyPick([], [])).toBeNull();
  });

  it("picks the nearest body mesh when several spheres overlap", () => {
    const nearMoon = new THREE.Mesh();
    nearMoon.userData.bodyId = "moon";
    const farEarth = new THREE.Mesh();
    farEarth.userData.bodyId = "earth";
    // intersectObjects returns distance-sorted hits (nearest first).
    const meshHits = [
      { object: nearMoon, distance: 55.0 },
      { object: farEarth, distance: 56.9 },
    ] as any;
    expect(resolveBodyPick(meshHits, [])).toBe("moon");
  });
});

describe("focusDistanceFor", () => {
  it("scales a normal planet to a comfortable view distance", () => {
    const d = focusDistanceFor(4);
    expect(d).toBeCloseTo(16, 4);
  });
  it("clamps tiny and huge bodies into the camera band", () => {
    expect(focusDistanceFor(0.01)).toBe(3); // min clamp
    expect(focusDistanceFor(1e4)).toBe(120); // max clamp
  });
});

describe("format body info", () => {
  it("renders a heliocentric planet in AU with Korean labels", () => {
    const info = formatBodyInfo(jupiter);
    expect(info.titleKo).toBe("목성");
    expect(info.titleEn).toBe("Jupiter");
    expect(info.typeKo).toBe(TYPE_LABEL_KO.planet);
    expect(info.distance).toContain("AU");
    expect(info.radius).toMatch(/km$/);
    expect(info.period).toMatch(/일$/);
  });

  it("renders a moon's distance in km with its parent-derived distance", () => {
    const info = formatBodyInfo(io);
    expect(info.typeKo).toBe(TYPE_LABEL_KO.moon);
    expect(info.distance).toMatch(/km$/);
    expect(Number(info.distance.replace(/[^\d.]/g, ""))).toBeGreaterThan(0);
  });

  it("handles the Sun (no orbit) gracefully", () => {
    const info = formatBodyInfo(sun);
    expect(info.titleKo).toBe("태양");
    expect(info.distance).toBe("—");
    expect(info.typeKo).toBe(TYPE_LABEL_KO.star);
  });

  it("keeps Pluto's high inclination visible (>= 1 decimal) in axial tilt", () => {
    const info = formatBodyInfo(pluto);
    const deg = parseFloat(info.axialTilt);
    expect(deg).toBeGreaterThan(12); // sanity per DATA_PLAN
  });

  it("produces descriptive alt text including the kind label", () => {
    expect(bodyAlt(jupiter)).toContain("Jupiter");
    expect(bodyAlt(io)).toContain("위성");
  });
});

describe("info panel \u2014 active scales + rendered values", () => {
  it("shows the default active distance/size scale labels", () => {
    const info = formatBodyInfo(jupiter, new ScaleManager());
    expect(info.distanceScale).toBe("로그 스케일");
    expect(info.sizeScale).toBe("강화 표시 (기본)");
  });

  it("reflects a supplied non-default scale in the labels", () => {
    const scale = new ScaleManager({
      distanceScale: "linear",
      radiusScale: "relative",
    });
    const info = formatBodyInfo(jupiter, scale);
    expect(info.distanceScale).toBe("선형 스케일");
    expect(info.sizeScale).toBe("상대 크기");
    expect(info.distanceRendered).toMatch(/장면 단위$/);
    expect(info.radiusRendered).toMatch(/장면 단위$/);
  });

  it("estimates rendered values (scene units) from the live scale, distinct from the real ones", () => {
    const info = formatBodyInfo(jupiter, new ScaleManager());
    // Real distance is in AU (dimensionless label); rendered distance has scene units.
    expect(info.distance).toContain("AU");
    expect(info.distanceRendered).toContain("장면 단위");
    expect(info.radius).toMatch(/km$/);
    expect(info.radiusRendered).toContain("장면 단위");
  });

  it("shows eccentricity and inclination for Pluto", () => {
    const info = formatBodyInfo(pluto);
    expect(info.eccentricity).toMatch(/0\.2\d+/);
    expect(info.inclination).toMatch(/°$/);
  });
});

describe("info panel moon list markup helpers", () => {
  it("lists a planet's moons in real distance order", () => {
    const ids = directMoonsOf("jupiter").map((m) => m.id);
    expect(ids).toEqual(["io", "europa", "ganymede", "callisto"]);
  });

  it("lists Pluto's five moons in real distance order", () => {
    const ids = directMoonsOf("pluto").map((m) => m.id);
    expect(ids).toEqual(["charon", "styx", "nix", "kerberos", "hydra"]);
  });

  it("returns an empty list for bodies with no moons", () => {
    expect(directMoonsOf("sun")).toEqual([]);
    expect(directMoonsOf("mercury")).toEqual([]);
    expect(directMoonsOf("venus")).toEqual([]);
    expect(directMoonsOf("io")).toEqual([]);
  });

  it("covers every dataset moon under exactly one parent", () => {
    const allMoons = SOLAR_SYSTEM.filter((b) => b.type === "moon");
    const parents = new Set(
      SOLAR_SYSTEM.filter((b) => b.parentId).map((b) => b.parentId as string),
    );
    // Every moon is reachable through its parent, with no orphans.
    const idSet = new Set(allMoons.map((m) => m.id));
    for (const pid of parents) {
      for (const m of directMoonsOf(pid)) idSet.delete(m.id);
    }
    expect(idSet.size).toBe(0);
    expect(allMoons.length).toBe(25);
  });
});

describe("Labels", () => {
  it("uses the Korean name for the in-scene tag primary", () => {
    expect(labelText(jupiter)).toBe("목성");
    expect(labelText(sun)).toBe("태양");
  });
});

describe("label density & moon-label reveal (§11)", () => {
  it("shows an English secondary line on the sprite beside the Korean primary", () => {
    expect(labelText(jupiter)).toBe("목성");
    expect(secondaryLabelText(jupiter)).toBe("Jupiter");
    expect(secondaryLabelText(sun)).toBe("Sun");
    expect(secondaryLabelText(io)).toBe("Io");
  });

  it("reveals a planet's moon labels only when that planet is selected", () => {
    // No selection -> moons hidden; selecting the parent reveals its moons.
    expect(shouldShowLabel("io", "moon", "jupiter", null, true)).toBe(false);
    expect(shouldShowLabel("io", "moon", "jupiter", "jupiter", true)).toBe(true);
    // A *different* planet's selection does not reveal another's moons.
    expect(shouldShowLabel("io", "moon", "jupiter", "earth", true)).toBe(false);
  });

  it("gates moon-label reveal on the global moons-visibility toggle", () => {
    expect(shouldShowLabel("io", "moon", "jupiter", "jupiter", false)).toBe(false);
    expect(shouldShowLabel("io", "moon", "jupiter", "io", false)).toBe(false);
  });

  it("keeps a selected moon's own label visible", () => {
    expect(shouldShowLabel("io", "moon", "jupiter", "io", true)).toBe(true);
  });

  it("never hides non-moon labels by selection or the moons toggle", () => {
    expect(shouldShowLabel("earth", "planet", undefined, null, true)).toBe(true);
    expect(shouldShowLabel("sun", "star", undefined, null, true)).toBe(true);
    expect(shouldShowLabel("earth", "planet", undefined, "jupiter", false)).toBe(true);
  });
});

describe("formatSimDays", () => {
  it("shows sub-day amounts in hours for a live read-out", () => {
    expect(formatSimDays(0.25)).toBe("6.0시간");
    expect(formatSimDays(0)).toBe("0.0시간");
  });
  it("shows whole/fractional days once past a day", () => {
    expect(formatSimDays(1)).toBe("1.0일");
    expect(formatSimDays(90)).toBe("90.0일");
  });
  it("rounds large day counts and never prints NaN", () => {
    expect(formatSimDays(1000)).toBe("1,000일");
    expect(formatSimDays(NaN)).toBe("0시간");
    expect(formatSimDays(-5)).toBe("0시간");
  });
});
