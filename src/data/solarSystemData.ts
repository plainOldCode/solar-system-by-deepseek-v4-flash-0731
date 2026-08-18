/**
 * Astronomical data module — SKELETON.
 *
 * Phase note: the actual JPL/NASA-backed dataset is populated by the
 * "core astronomical data" phase. This bootstrap phase establishes only the
 * shared data model so every consumer (rendering, simulation, UI) compiles
 * against a stable contract. No real astronomical values are fabricated here.
 *
 * See DATA_PLAN.md at the repository root for the full data provenance,
 * field/unit theory, hierarchy, and validation strategy.
 */

/** Shared celestial-body data model (spec §7). */
export interface CelestialBodyData {
  id: string;
  nameKo: string;
  nameEn: string;
  type: "star" | "planet" | "dwarf-planet" | "moon";
  parentId?: string;

  radiusKm: number;
  semiMajorAxis?: number;
  semiMajorAxisUnit?: "AU" | "km";
  eccentricity?: number;
  inclinationDeg?: number;
  orbitalPeriodDays?: number;
  rotationPeriodHours?: number;
  axialTiltDeg?: number;

  displayColor: string;
  description?: string;
}

/**
 * Placeholder — intentionally empty until the core-data phase loads the
 * canonical JPL/NASA dataset. Keeping it a stable export means other modules
 * can already import the type contract before data arrives.
 * TODO(core-data): populate with real values, never arbitrary fiction.
 */
export const SOLAR_SYSTEM: CelestialBodyData[] = [];
