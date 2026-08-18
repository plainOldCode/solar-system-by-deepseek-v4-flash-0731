/**
 * Dataset + validator tests (vitest).
 *
 * Two layers: (1) positive tests asserting the real dataset meets the DATA_PLAN
 * contract, and (2) negative tests mutating copies to prove the validator
 * catches each class of defect (uniqueness, required fields, parent references,
 * numeric ranges, unit consistency, ordering). All operate on data + pure
 * validation only — no rendering.
 */

import { describe, it, expect } from "vitest";
import { SOLAR_SYSTEM } from "../solarSystemData";
import { validateSolarSystem } from "../validate";
import type { CelestialBodyData } from "../types";

function clone(): CelestialBodyData[] {
  return SOLAR_SYSTEM.map((b) => ({ ...b }));
}

function codes(data: CelestialBodyData[]): string[] {
  return validateSolarSystem(data).issues.map((i) => i.code);
}

const has = (list: string[], code: string) => list.includes(code);

describe("dataset coverage", () => {
  it("contains exactly 35 bodies", () => {
    expect(SOLAR_SYSTEM.length).toBe(35);
  });

  it("has 1 star, 8 planets, 1 dwarf-planet, 25 moons", () => {
    const count = (t: string) => SOLAR_SYSTEM.filter((b) => b.type === t).length;
    expect(count("star")).toBe(1);
    expect(count("planet")).toBe(8);
    expect(count("dwarf-planet")).toBe(1);
    expect(count("moon")).toBe(25);
  });

  it("covers the specified parent systems", () => {
    const moonParents = new Set(
      SOLAR_SYSTEM.filter((b) => b.type === "moon").map((b) => b.parentId),
    );
    expect([...moonParents].sort()).toEqual(
      ["earth", "jupiter", "mars", "neptune", "pluto", "saturn", "uranus"],
    );
  });
});

describe("validation — clean dataset", () => {
  it("reports zero issues for SOLAR_SYSTEM and is valid", () => {
    const result = validateSolarSystem(SOLAR_SYSTEM);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });
});

describe("uniqueness", () => {
  it("detects a duplicate id", () => {
    const data = clone();
    data.push({ ...data[0] }); // 'sun' duplicated
    expect(has(codes(data), "duplicate-id")).toBe(true);
  });
  it("has unique ids in the real dataset", () => {
    const ids = SOLAR_SYSTEM.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("required fields", () => {
  it("detects a missing id", () => {
    const data = clone();
    delete (data[0] as { id?: string }).id;
    expect(has(codes(data), "missing-id")).toBe(true);
  });
  it("detects a missing nameKo", () => {
    const data = clone();
    (data[1] as { nameKo?: string }).nameKo = "";
    expect(has(codes(data), "required-field")).toBe(true);
  });
  it("detects a missing nameEn", () => {
    const data = clone();
    (data[2] as { nameEn?: string }).nameEn = "";
    expect(has(codes(data), "required-field")).toBe(true);
  });
  it("every body has nameKo/nameEn/type", () => {
    for (const b of SOLAR_SYSTEM) {
      expect(b.nameKo.trim().length).toBeGreaterThan(0);
      expect(b.nameEn.trim().length).toBeGreaterThan(0);
      expect(["star", "planet", "dwarf-planet", "moon"]).toContain(b.type);
    }
  });
});

describe("parent references", () => {
  it("every moon's parent exists and every planet/dwarf has all their moons", () => {
    const byId = new Map(SOLAR_SYSTEM.map((b) => [b.id, b]));
    for (const b of SOLAR_SYSTEM) {
      if (b.type === "moon") {
        expect(byId.has(b.parentId!)).toBe(true);
        const p = byId.get(b.parentId!)!;
        expect(["planet", "dwarf-planet"]).toContain(p.type);
      }
    }
  });
  it("detects a moon whose parent is missing", () => {
    const data = clone();
    const idx = SOLAR_SYSTEM.findIndex((b) => b.id === "io");
    (data[idx] as { parentId?: string }).parentId = "does-not-exist";
    expect(has(codes(data), "parent-missing")).toBe(true);
  });
  it("detects a non-moon body that declares a parentId", () => {
    const data = clone();
    data[0].parentId = "earth"; // sun
    expect(has(codes(data), "unexpected-parent")).toBe(true);
  });
  it("detects a moon without a parent", () => {
    const data = clone();
    const idx = SOLAR_SYSTEM.findIndex((b) => b.id === "moon");
    (data[idx] as { parentId?: string }).parentId = undefined;
    expect(has(codes(data), "moon-without-parent")).toBe(true);
  });
});

describe("numeric ranges", () => {
  it("radii are positive and finite", () => {
    for (const b of SOLAR_SYSTEM) {
      expect(Number.isFinite(b.radiusKm)).toBe(true);
      expect(b.radiusKm).toBeGreaterThan(0);
    }
  });
  it("eccentricity within [0,1]", () => {
    for (const b of SOLAR_SYSTEM) {
      if (b.eccentricity !== undefined)
        expect(b.eccentricity).toBeGreaterThanOrEqual(0);
      if (b.eccentricity !== undefined) expect(b.eccentricity).toBeLessThanOrEqual(1);
    }
  });
  it("inclination within [0,180]", () => {
    for (const b of SOLAR_SYSTEM) {
      if (b.inclinationDeg !== undefined)
        expect(b.inclinationDeg).toBeGreaterThanOrEqual(0);
      if (b.inclinationDeg !== undefined)
        expect(b.inclinationDeg).toBeLessThanOrEqual(180);
    }
  });
  it("detects an out-of-range eccentricity", () => {
    const data = clone();
    const idx = SOLAR_SYSTEM.findIndex((b) => b.id === "earth");
    data[idx].eccentricity = 1.5;
    expect(has(codes(data), "eccentricity-range")).toBe(true);
  });
  it("detects an out-of-range inclination", () => {
    const data = clone();
    const idx = SOLAR_SYSTEM.findIndex((b) => b.id === "earth");
    data[idx].inclinationDeg = -5;
    expect(has(codes(data), "inclination-range")).toBe(true);
  });
  it("detects a non-positive semi-major axis", () => {
    const data = clone();
    const idx = SOLAR_SYSTEM.findIndex((b) => b.id === "earth");
    data[idx].semiMajorAxis = 0;
    expect(has(codes(data), "semi-major-axis-range")).toBe(true);
  });
  it("Venus rotates retrograde (negative hours) as recorded", () => {
    const venus = SOLAR_SYSTEM.find((b) => b.id === "venus")!;
    expect(venus.rotationPeriodHours).toBeLessThan(0);
  });
  it("Pluto eccentricity > 0.2 and inclination > 12°", () => {
    const pluto = SOLAR_SYSTEM.find((b) => b.id === "pluto")!;
    expect(pluto.eccentricity).toBeGreaterThan(0.2);
    expect(pluto.inclinationDeg).toBeGreaterThan(12);
  });
});

describe("unit consistency", () => {
  it("non-moon bodies use AU and moons use km", () => {
    for (const b of SOLAR_SYSTEM) {
      if (b.semiMajorAxis === undefined) continue;
      if (b.type === "moon") {
        expect(b.semiMajorAxisUnit).toBe("km");
        expect(b.semiMajorAxis).toBeGreaterThan(0);
      } else {
        expect(b.semiMajorAxisUnit).toBe("AU");
      }
    }
  });
  it("detects a planet with a missing unit", () => {
    const data = clone();
    const idx = SOLAR_SYSTEM.findIndex((b) => b.id === "mars");
    (data[idx] as { semiMajorAxisUnit?: "AU" | "km" }).semiMajorAxisUnit = undefined;
    expect(has(codes(data), "missing-unit")).toBe(true);
  });
  it("detects a planet wrongly using km despite being non-moon", () => {
    const data = clone();
    const idx = SOLAR_SYSTEM.findIndex((b) => b.id === "earth");
    data[idx].semiMajorAxisUnit = "km";
    expect(has(codes(data), "heliocentric-unit")).toBe(true);
  });
});

describe("ordering", () => {
  it("heliocentric distances strictly increase (Mercury < … < Pluto)", () => {
    const bodies = SOLAR_SYSTEM.filter(
      (b) => b.type === "planet" || b.type === "dwarf-planet",
    ).sort((a, b2) => (a.semiMajorAxis ?? 0) - (b2.semiMajorAxis ?? 0));
    const expectedIds = [
      "mercury", "venus", "earth", "mars", "jupiter",
      "saturn", "uranus", "neptune", "pluto",
    ];
    expect(bodies.map((b) => b.id)).toEqual(expectedIds);
    for (let i = 1; i < bodies.length; i++)
      expect(bodies[i].semiMajorAxis!).toBeGreaterThan(bodies[i - 1].semiMajorAxis!);
  });

  it("moon distances within each system are ordered by real distance", () => {
    const byParent = new Map<string, CelestialBodyData[]>();
    for (const b of SOLAR_SYSTEM)
      if (b.type === "moon") {
        const key = b.parentId!;
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key)!.push(b);
      }
    for (const moons of byParent.values()) {
      const sorted = [...moons].sort((a, b) => (a.semiMajorAxis ?? 0) - (b.semiMajorAxis ?? 0));
      expect(moons.map((m) => m.id)).toEqual(sorted.map((m) => m.id));
    }
  });
  it("detects a moon out of distance order", () => {
    const data = clone();
    // Swap io/europa semi-major axes to break order.
    const ioIndex = SOLAR_SYSTEM.findIndex((b) => b.id === "io");
    data[ioIndex].semiMajorAxis = 671034;
    expect(has(codes(data), "moon-distance-order")).toBe(true);
  });
  it("planets are sized per spec (Jupiter/Saturn ≫ Earth, Mercury/Mars/Pluto < Earth)", () => {
    const byId = (id: string) => SOLAR_SYSTEM.find((b) => b.id === id)!;
    expect(byId("jupiter").radiusKm).toBeGreaterThan(byId("earth").radiusKm * 5);
    expect(byId("saturn").radiusKm).toBeGreaterThan(byId("earth").radiusKm * 5);
    expect(byId("mercury").radiusKm).toBeLessThan(byId("earth").radiusKm);
    expect(byId("mars").radiusKm).toBeLessThan(byId("earth").radiusKm);
    expect(byId("pluto").radiusKm).toBeLessThan(byId("mercury").radiusKm);
  });
});
