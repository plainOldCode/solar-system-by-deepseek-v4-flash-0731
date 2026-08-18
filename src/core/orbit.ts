/**
 * Orbital simulation — deterministic, time-based Keplerian positions.
 *
 * Pure math (no Three.js) so it is independently unit-testable and shareable
 * between the renderer and any analytical consumers. Given a body's real
 * orbital parameters and a simulated time in days, returns its position in
 * kilometres relative to its parent body (planets orbit the Sun at heliocentric
 * distances; moons orbit their parent at planetocentric distances).
 *
 * Model: mean anomaly M = 2π·t/T + phase0; Kepler's equation M = E − e·sin E
 * solved numerically for the eccentric anomaly E; then a circle of radius a
 * deformed to an ellipse, rotated by the orbit's inclination. The longitude of
 * ascending node and argument of perihelion are not in the data set, so both
 * default to 0 and the orbit opens around the parent in the reference plane —
 * this keeps the output fully deterministic and testable.
 */

/** Vec3 in a right-handed coordinate system. Y-up convention for the scene. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface OrbitParams {
  /** Distance from the parent at the orbit's mean radius, in km. */
  semiMajorAxisKm: number;
  /** Orbital period in days. Must be > 0 for motion; <=0 treated as static. */
  periodDays: number;
  /** Eccentricity in [0, 1). Absorbed safely: extremes are clamped to 0.999. */
  eccentricity?: number;
  /** Orbital inclination in degrees, [0, 180]. Applied about the X axis. */
  inclinationDeg?: number;
  /** Initial angular offset in degrees at t=0. Deterministic seed for spread. */
  initialPhaseDeg?: number;
}

export interface OrbitResult {
  /** Body position relative to its parent, in km. */
  position: Vec3;
  /** True anomaly of the body at this time (radians). */
  anomalyRad: number;
  /** Current radius from the parent (km) — a·(1−e·cos E). */
  radiusKm: number;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Newton–Raphson solver for Kepler's equation M = E − e·sin E. Deterministic. */
function solveKepler(M: number, e: number, iterations = 10): number {
  let E = M;
  for (let i = 0; i < iterations; i++) {
    const f = E - e * Math.sin(E) - M;
    const df = 1 - e * Math.cos(E);
    if (Math.abs(df) < 1e-12) break;
    const dE = f / df;
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/** Clamp x into [lo, hi]; guard empty/degenerate intervals. */
function clamp(x: number, lo: number, hi: number): number {
  if (!(lo <= hi)) return lo;
  return Math.min(Math.max(x, lo), hi);
}

function normalizeAngle(rad: number): number {
  const twoPi = 2 * Math.PI;
  let a = rad % twoPi;
  if (a < 0) a += twoPi;
  return a;
}

/**
 * Compute the body's Keplerian orbital position at simulated day `t`.
 * Deterministic: identical params + t give identical output. Periodic in T.
 */
export function orbitalPosition(params: OrbitParams, timeDays: number): OrbitResult {
  const a = params.semiMajorAxisKm;
  const T = params.periodDays;
  const e = clamp(
    Number.isFinite(params.eccentricity) ? params.eccentricity! : 0,
    0,
    0.999,
  );
  const iRad = degToRad(
    clamp(Number.isFinite(params.inclinationDeg) ? params.inclinationDeg! : 0, 0, 180),
  );
  const phase0 = degToRad(
    Number.isFinite(params.initialPhaseDeg) ? params.initialPhaseDeg! : 0,
  );

  // Static body (no period or non-finite) → return initial point on a circle.
  if (!(T > 0) || !Number.isFinite(a) || a <= 0) {
    // Deterministic fallback: stationary at phase on unit-less radius default 1 km.
    const staticRadius = Number.isFinite(a) && a > 0 ? a : 1;
    const x = staticRadius * Math.cos(phase0);
    const yPlanet = 0;
    const z = staticRadius * Math.sin(phase0);
    return { position: { x, y: yPlanet, z }, anomalyRad: phase0, radiusKm: staticRadius };
  }

  // Mean anomaly (mod 2π keeps output periodic in T).
  const M = normalizeAngle((2 * Math.PI * timeDays) / T + phase0);
  const E = solveKepler(M, e);

  // Body in orbital (reference) plane, then rotate by inclination about X.
  const planeX = a * (Math.cos(E) - e);
  const planeY = a * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E);
  const cosI = Math.cos(iRad);
  const sinI = Math.sin(iRad);
  const x = planeX;
  const y = planeY * cosI;
  const z = planeY * sinI;

  // True anomaly = angle of actual position relative to periapsis direction.
  const anomalyRad = Math.atan2(planeY, planeX);
  const radiusKm = a * (1 - e * Math.cos(E));

  return { position: { x, y, z }, anomalyRad, radiusKm };
}

/** Add two vectors (used to nest moon position within planet position). */
export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
