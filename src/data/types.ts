/**
 * Core astronomical data model — typed interfaces only.
 *
 * Raw data (the populated dataset) lives in solarSystemData.ts; this module
 * defines the shapes both data and consumers contract against. Nothing here
 * concerns rendering; it is the single source of truth for a body's identity,
 * hierarchy, physical/orbital properties, units, and provenance.
 */

/** The kind of celestial body. */
export type BodyType = "star" | "planet" | "dwarf-planet" | "moon";

/** Unit of `semiMajorAxis`. AU is heliocentric; km is from the parent body. */
export type DistanceUnit = "AU" | "km";

/**
 * Provenance — where a recorded value comes from. Each body may carry a
 * human-readable source label so no value is untraceable.
 */
export interface Provenance {
  /** Canonical source label, e.g. "NASA/NSSDC Planetary Fact Sheet". */
  source: string;
  /** Optional per-body note, e.g. "retrograde orbit". */
  note?: string;
}

/** Shared celestial-body data model (spec §7). */
export interface CelestialBodyData {
  /** Slug id, unique across the dataset, e.g. "jupiter". */
  id: string;
  nameKo: string;
  nameEn: string;
  type: BodyType;
  /** Moons only; planets/dwarf/star have none (orbit the Sun implicitly). */
  parentId?: string;

  /** Actual body radius in km (> 0). */
  radiusKm: number;
  /** Semi-major axis; unit is declared explicitly by `semiMajorAxisUnit`. */
  semiMajorAxis?: number;
  semiMajorAxisUnit?: DistanceUnit;
  /** Orbital eccentricity, [0, 1]. */
  eccentricity?: number;
  /** Orbital inclination, [0, 180] degrees. */
  inclinationDeg?: number;
  /** Sidereal orbital period in days (> 0; signed for retrograde moons). */
  orbitalPeriodDays?: number;
  /** Sidereal rotation period in hours; signed negative = retrograde. */
  rotationPeriodHours?: number;
  /** Display tilt in degrees, [0, 180]. */
  axialTiltDeg?: number;

  displayColor: string;
  /** Short Korean description shown in the info panel. */
  description?: string;

  source?: string;
}
