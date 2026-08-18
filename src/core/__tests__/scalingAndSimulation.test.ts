import { describe, it, expect } from "vitest";
import {
  AU_KM,
  ScaleManager,
} from "../ScaleManager";
import {
  orbitalPosition,
  addVec3,
  type Vec3,
} from "../orbit";
import { SimulationClock } from "../SimulationClock";
import { SOLAR_SYSTEM } from "../../data/solarSystemData";

function bodyOf(id: string) {
  const b = SOLAR_SYSTEM.find((x) => x.id === id);
  if (!b) throw new Error(`missing ${id}`);
  return b;
}

function distanceKm(bodyId: string): number {
  const b = bodyOf(bodyId);
  if (b.semiMajorAxisUnit === "AU") {
    return b.semiMajorAxis! * AU_KM;
  }
  return b.semiMajorAxis!;
}

describe("ScaleManager", () => {
  it("is deterministic across instances", () => {
    const a = new ScaleManager();
    const b = new ScaleManager();
    for (const km of [0, 1, 100, 1e6, 5.9e9]) {
      expect(a.distance(km)).toBe(b.distance(km));
      expect(a.radius(km)).toBe(b.radius(km));
    }
  });

  it("maps representative distances monotonically", () => {
    const s = new ScaleManager();
    const order = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
    const values = order.map((id) => s.distance(distanceKm(id)));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it("flattens the huge range: Pluto is a modest multiple of Mercury", () => {
    const s = new ScaleManager();
    const mercury = s.distance(distanceKm("mercury"));
    const pluto = s.distance(distanceKm("pluto"));
    expect(pluto / mercury).toBeLessThan(50);
    expect(pluto / mercury).toBeGreaterThan(1);
  });

  it("keeps moons visible and on a smaller scale than planets", () => {
    const s = new ScaleManager();
    const moon = s.distance(distanceKm("moon"));
    const earth = s.distance(distanceKm("earth"));
    expect(moon).toBeGreaterThan(0);
    expect(moon).toBeLessThan(earth);
  });

  it("returns finite values for huge and tiny inputs", () => {
    const s = new ScaleManager();
    for (const km of [1e-12, 1e-9, 1e-6, 1e9, 1e12, 1e20]) {
      expect(Number.isFinite(s.distance(km))).toBe(true);
      expect(Number.isFinite(s.radius(km))).toBe(true);
    }
  });

  it("zero and negative inputs map safely to zero distance", () => {
    const s = new ScaleManager();
    expect(s.distance(0)).toBe(0);
    expect(s.distance(-5)).toBe(0);
    expect(s.distance(Number.NaN)).toBe(0);
  });

  it("finite output for huge finite input", () => {
    const s = new ScaleManager();
    expect(Number.isFinite(s.distance(1e30))).toBe(true);
    expect(Number.isFinite(s.radius(1e30))).toBe(true);
  });

  it("radius maps Sun exactly to sunSceneRadius and clamps to floor", () => {
    const s = new ScaleManager({ sunSceneRadius: 4, minSceneRadius: 0.2 });
    expect(s.radius(696_340)).toBeCloseTo(4, 10);
    expect(s.radius(0)).toBeGreaterThan(0);
    expect(s.radius(0)).toBeGreaterThanOrEqual(0.2);
    expect(s.radius(Number.NaN)).toBeGreaterThan(0);
  });

  it("radius is monotonic from moon to planet to Sun", () => {
    const s = new ScaleManager();
    expect(s.radius(bodyOf("phobos").radiusKm)).toBeLessThan(s.radius(bodyOf("earth").radiusKm));
    expect(s.radius(bodyOf("earth").radiusKm)).toBeLessThan(s.radius(696_340));
  });

  it("supports linear distance mode", () => {
    const s = new ScaleManager({ distanceScale: "linear", linearDistanceGain: 1e-9 });
    expect(s.distance(AU_KM).toFixed(3)).toBe("0.150");
    expect(s.distance(0)).toBe(0);
    s.setDistanceMode("log");
    expect(s.distance(AU_KM)).toBeGreaterThan(0);
  });

  it("degenerate log floor is guarded", () => {
    const s = new ScaleManager({ distanceFloorKm: -5, distanceGain: 2 });
    expect(s.distance(5.9e9)).toBeGreaterThan(0);
    expect(Number.isFinite(s.distance(1e-300))).toBe(true);
  });
});

describe("SimulationClock", () => {
  it("advances deterministically", () => {
    const c = new SimulationClock();
    expect(c.advance(10)).toBe(10);
    expect(c.advance(10)).toBe(20);
    expect(c.timeDays).toBeCloseTo(20 / 86_400, 8);
  });

  it("honors pause", () => {
    const c = new SimulationClock(0, 2, true);
    expect(c.advance(100)).toBe(0);
    c.setPaused(false);
    expect(c.advance(100)).toBe(200);
  });

  it("honors speed multiplier", () => {
    const c = new SimulationClock(0, 4);
    expect(c.advance(25)).toBe(100);
    c.setSpeed(1);
    expect(c.advance(10)).toBe(110);
  });

  it("reset returns to a given time and is deterministic", () => {
    const a = new SimulationClock(0, 1);
    const b = new SimulationClock(0, 1);
    for (let i = 0; i < 50; i++) {
      a.advance(0.7);
      b.advance(0.7);
    }
    expect(a.timeSec).toBe(b.timeSec);
    a.reset(500);
    expect(a.timeSec).toBe(500);
  });

  it("rejects non-positive speeds and keeps current speed", () => {
    const c = new SimulationClock(0, 2);
    c.setSpeed(0);
    expect(c.speed).toBe(2);
    c.setSpeed(Number.NaN);
    expect(c.speed).toBe(2);
  });
});

describe("orbitalPosition", () => {
  const earthA = distanceKm("earth");

  it("is periodic in T, returning the same position at t+T", () => {
    const p = { semiMajorAxisKm: earthA, periodDays: 365.256, eccentricity: 0.0167 };
    const a = orbitalPosition(p, 100);
    const b = orbitalPosition(p, 100 + 365.256);
    expect(a.position.x).toBeCloseTo(b.position.x, 6);
    expect(a.position.y).toBeCloseTo(b.position.y, 6);
    expect(a.position.z).toBeCloseTo(b.position.z, 6);
  });

  it("places a circular orbit on a circle of radius a", () => {
    const p = { semiMajorAxisKm: earthA, periodDays: 1, eccentricity: 0 };
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const r = Math.hypot(orbitalPosition(p, t).position.x, orbitalPosition(p, t).position.y, orbitalPosition(p, t).position.z);
      expect(r).toBeCloseTo(earthA, 5);
    }
  });

  it("applies inclination (>0 tilts above the plane)", () => {
    const p = { semiMajorAxisKm: earthA, periodDays: 1, eccentricity: 0, inclinationDeg: 45 };
    const quarter = orbitalPosition(p, 0.25); // at +Y in orbital plane
    expect(quarter.position.y).toBeCloseTo(quarter.position.z, 5);
    expect(quarter.position.y).toBeGreaterThan(0);
    expect(quarter.position.z).toBeGreaterThan(0);
  });

  it("derives a larger radius for the same eccentricity at perihelion", () => {
    const p = { semiMajorAxisKm: earthA, periodDays: 1, eccentricity: 0.2 };
    // With phase 0, periapsis is at t=0 → radius = a(1−e).
    expect(orbitalPosition(p, 0).radiusKm).toBeCloseTo(earthA * (1 - 0.2), 3);
  });

  it("handles zero / tiny semi-major axis and non-finite period safely", () => {
    expect(orbitalPosition({ semiMajorAxisKm: 0, periodDays: 1 }, 10).position.x).toBe(1);
    expect(Number.isFinite(orbitalPosition({ semiMajorAxisKm: 1e-9, periodDays: 1 }, 10).position.x)).toBe(true);
    const staticP = orbitalPosition({ semiMajorAxisKm: 500, periodDays: 0 }, 100);
    expect(staticP.position.x).toBe(500 * Math.cos(0));
    expect(staticP.position.y).toBe(0);
  });

  it("is deterministic", () => {
    const p = { semiMajorAxisKm: AU_KM * 2, periodDays: 4332.59, eccentricity: 0.0489, inclinationDeg: 1.303, initialPhaseDeg: 0.7 };
    const a = orbitalPosition(p, 1234.56);
    const b = orbitalPosition(p, 1234.56);
    expect(a).toEqual(b);
  });

  it("combines via addVec3 for nested body hierarchy", () => {
    const planet = orbitalPosition(
      { semiMajorAxisKm: AU_KM, periodDays: 365.256, eccentricity: 0.0167, initialPhaseDeg: 10 },
      42,
    ).position;
    const moon = orbitalPosition(
      { semiMajorAxisKm: 384_400, periodDays: 27.322, eccentricity: 0.0549, initialPhaseDeg: -15 },
      42,
    ).position;
    const total: Vec3 = addVec3(planet, moon);
    expect(Number.isFinite(total.x)).toBe(true);
    expect(Number.isFinite(total.y)).toBe(true);
    // Moon is always far inside the planet's orbit span.
    expect(Math.hypot(moon.x, moon.y, moon.z)).toBeLessThan(AU_KM);
  });

  it("matches an explicit Earth-at-one-quarter-after-perihelion position", () => {
    const p = { semiMajorAxisKm: earthA, periodDays: 365.256, eccentricity: 0 };
    // t = T/4 → M = π/2, E = π/2, planeY = a → (x,y,z)=(a·0,a·cos0,a·sin0)=(0,a,0).
    const q = orbitalPosition(p, 365.256 / 4);
    expect(q.position.x).toBeCloseTo(0, 5);
    expect(q.position.y).toBeCloseTo(earthA, 3);
    expect(q.position.z).toBe(0);
  });
});
