/**
 * Dataset validation — makes invalid or inconsistent records detectable.
 *
 * Pure, dependency-free functions over the data model. The `validateSolarSystem`
 * entry point returns every issue found (not the first one), so callers can
 * decide how to surface them (tests vs a CLI/failed run). Nothing here touches
 * rendering.
 *
 * Issue `code` strings are stable and testable — prefer checking issue codes
 * over regexing message text in tests.
 */

import type { CelestialBodyData } from "./types";

export interface ValidationIssue {
  /** Stable machine-readable code, e.g. "duplicate-id". */
  code: string;
  /** Human-readable description. */
  message: string;
  /** Body id the issue relates to, when applicable. */
  bodyId?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  get valid(): boolean;
}

function issue(
  code: string,
  message: string,
  bodyId?: string,
): ValidationIssue {
  return { code, message, bodyId };
}

/** Body types that are not moons (orbit the Sun directly). */
const ROOT_TYPES: ReadonlySet<string> = new Set([
  "star",
  "planet",
  "dwarf-planet",
]);

/** Body types that must declare a parentId. */
const MOON_PARENT_ALLOWED: ReadonlySet<string> = new Set([
  "planet",
  "dwarf-planet",
]);

export function validateSolarSystem(
  data: readonly CelestialBodyData[],
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Unique ids + primary key by id.
  const byId = new Map<string, CelestialBodyData>();
  for (const body of data) {
    if (!body.id) {
      issues.push(issue("missing-id", `Body at index has no id`));
      continue;
    }
    if (byId.has(body.id)) {
      issues.push(issue("duplicate-id", `Duplicate body id "${body.id}"`, body.id));
    } else {
      byId.set(body.id, body);
    }
  }

  for (const body of data) {
    if (!body.id) continue;
    requiredString(body, "nameKo", issues);
    requiredString(body, "nameEn", issues);
    requiredStringNonNull(body, "type", issues);
    if (body.type && !ROOT_TYPES.has(body.type) && body.type !== "moon") {
      issues.push(issue("invalid-type", `Invalid type "${body.type}" for "${body.id}"`, body.id));
    }

    // Radius: required for every body, positive, finite.
    if (typeof body.radiusKm !== "number" || !Number.isFinite(body.radiusKm)) {
      issues.push(issue("radius-required", `"${body.id}" radiusKm must be a finite number`, body.id));
    } else if (body.radiusKm <= 0) {
      issues.push(issue("radius-range", `"${body.id}" radiusKm must be > 0 (got ${body.radiusKm})`, body.id));
    }

    // Eccentricity within [0,1].
    if (body.eccentricity !== undefined) {
      if (!(body.eccentricity >= 0 && body.eccentricity <= 1)) {
        issues.push(issue("eccentricity-range", `"${body.id}" eccentricity ${body.eccentricity} outside [0,1]`, body.id));
      }
    }

    // Inclination within [0,180].
    if (body.inclinationDeg !== undefined && !(body.inclinationDeg >= 0 && body.inclinationDeg <= 180)) {
      issues.push(issue("inclination-range", `"${body.id}" inclinationDeg ${body.inclinationDeg} outside [0,180]`, body.id));
    }

    // Positive quantities that must never be zero/negative.
    // rotationPeriodHours/orbitalPeriodDays are signed (negative = retrograde)
    // per DATA_PLAN; axialTiltDeg is range-checked above in [0,180].
    if (body.semiMajorAxis !== undefined && !(body.semiMajorAxis > 0)) {
      issues.push(issue("semi-major-axis-range", `"${body.id}" semiMajorAxis must be > 0 (got ${body.semiMajorAxis})`, body.id));
    }

    // Units.
    if (body.semiMajorAxis !== undefined) {
      if (body.semiMajorAxisUnit !== "AU" && body.semiMajorAxisUnit !== "km") {
        issues.push(issue("missing-unit", `"${body.id}" semiMajorAxis present but unit missing/invalid`, body.id));
      }
    } else if (body.semiMajorAxisUnit !== undefined) {
      issues.push(issue("unit-without-value", `"${body.id}" declares unit but no semiMajorAxis value`, body.id));
    }

    // Hierarchy.
    if (body.type === "moon") {
      if (!body.parentId) {
        issues.push(issue("moon-without-parent", `"${body.id}" is a moon but has no parentId`, body.id));
      } else if (!byId.has(body.parentId)) {
        issues.push(issue("parent-missing", `"${body.id}" parentId "${body.parentId}" does not exist`, body.id));
      } else {
        const parent = byId.get(body.parentId)!;
        if (!MOON_PARENT_ALLOWED.has(parent.type)) {
          issues.push(issue("parent-type", `"${body.id}" parent "${body.parentId}" is ${parent.type}, expected a planet/dwarf-planet`, body.id));
        }
      }
    } else {
      if (body.parentId !== undefined) {
        issues.push(issue("unexpected-parent", `"${body.id}" type ${body.type} must not declare a parentId`, body.id));
      }
      // Only bodies that actually carry a semi-major axis value are held to the
      // AU unit contract (the Sun legitimately has none).
      if (body.semiMajorAxis !== undefined && body.semiMajorAxisUnit !== "AU") {
        issues.push(issue("heliocentric-unit", `"${body.id}" (non-moon) must use AU for semiMajorAxis`, body.id));
      }
    }
  }

  // Unit consistency + monotonic order across the heliocentric bodies.
  const heliocentric = data.filter(
    (b) => b.type === "planet" || b.type === "dwarf-planet",
  );
  heliocentric.sort((a, b) => (a.semiMajorAxis ?? 0) - (b.semiMajorAxis ?? 0));

  // Non-decreasing distance (all logs are positive, so any decrease is a real defect).
  for (let i = 1; i < heliocentric.length; i++) {
    const prev = heliocentric[i - 1].semiMajorAxis;
    const curr = heliocentric[i].semiMajorAxis;
    if (prev === undefined || curr === undefined) continue;
    if (curr <= prev) {
      issues.push(
        issue("distance-order", `Heliocentric distances out of order: "${heliocentric[i - 1].id}" (${prev}) before "${heliocentric[i].id}" (${curr})`, heliocentric[i].id),
      );
    }
  }

  // Non-decreasing radius within each moon system (real distance order) and
  // size order of planets (largest at end via radius).
  const byParent = new Map<string, CelestialBodyData[]>();
  for (const body of data) {
    if (body.type !== "moon") continue;
    const key = body.parentId ?? "";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(body);
  }
  for (const [parentId, moons] of byParent) {
    moons.sort((a, b) => (a.semiMajorAxis ?? 0) - (b.semiMajorAxis ?? 0));
    for (let i = 1; i < moons.length; i++) {
      const prev = moons[i - 1].semiMajorAxis;
      const curr = moons[i].semiMajorAxis;
      if (prev === undefined || curr === undefined) continue;
      if (curr <= prev) {
        issues.push(
          issue("moon-distance-order", `Moons of "${parentId}" out of distance order: "${moons[i - 1].id}" (${prev}) before "${moons[i].id}" (${curr})`, moons[i].id),
        );
      }
    }
  }

  // Planet size order: biggest (Jupiter) must come after smaller when sorted by
  // radius ascending, actual ascending order: Mercury<Mars<Venus<Earth<Uranus<Neptune<Saturn<Jupiter
  // Check monotonicity of radius across the sorted-by-radius heliocentric list.
  const heliocentricByRadius = [...heliocentric].sort((a, b) => a.radiusKm - b.radiusKm);
  for (let i = 1; i < heliocentricByRadius.length; i++) {
    const prev = heliocentricByRadius[i - 1];
    const curr = heliocentricByRadius[i];
    if (curr.radiusKm < prev.radiusKm) {
      issues.push(issue("size-order", `Body sizes out of order: "${prev.id}" (${prev.radiusKm} km) should precede "${curr.id}" (${curr.radiusKm} km)`, curr.id));
    }
  }

  return {
    issues,
    get valid() {
      return this.issues.length === 0;
    },
  };
}

function requiredString(body: CelestialBodyData, field: "nameKo" | "nameEn", issues: ValidationIssue[]) {
  const value = body[field];
  if (typeof value !== "string" || value.trim() === "") {
    issues.push(issue("required-field", `"${body.id}" ${field} must be a non-empty string`, body.id));
  }
}

function requiredStringNonNull(body: CelestialBodyData, field: "type", issues: ValidationIssue[]) {
  if (typeof body.type !== "string" || body.type.length === 0) {
    issues.push(issue("required-field", `"${body.id}" ${field} must be set`, body.id));
  }
}
