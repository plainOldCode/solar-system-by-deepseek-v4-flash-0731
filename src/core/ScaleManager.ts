/**
 * ScaleManager — logarithmic / linear scaling of real astronomical distances
 * and radii into scene units.
 *
 * Pure, Three.js-free math so it is trivially unit-testable and reusable by
 * both the Three.js renderer and the UI (readouts, minimap). Guarantees:
 *  - finite output for any finite input (cosmetic clamps to large bounds);
 *  - zero / tiny inputs map safely (never NaN, never negative);
 *  - monotonic non-decreasing mapping in every mode;
 *  - deterministic — identical options and inputs give identical scene values.
 *
 * Radial (distance-from-parent) and size (radius) mappings are kept separate
 * so each can use its own mode and constants.
 */

/** One astronomical unit in kilometres (IAU 2012 def). */
export const AU_KM = 149_597_870.7;

export type DistanceScaleMode = "log" | "linear";
export type RadiusScaleMode = "log" | "linear";

export interface ScaleManagerOptions {
  /** Distance mapping mode. Default "log". */
  distanceScale?: DistanceScaleMode;
  /** Radius mapping mode. Default "log". */
  radiusScale?: RadiusScaleMode;
  /**
   * Log distance: scene distance = distanceGain * log10(1 + km/distanceFloorKm).
   * Larger floor concentrates near-zero, smaller spreads inner system.
   */
  distanceGain?: number;
  /** Km below which log-distance maps toward 0. Must be > 0. */
  distanceFloorKm?: number;
  /** Linear distance gain, scene units per km. Sun at ~1 AU would be 0.39. */
  linearDistanceGain?: number;

  /** Scene radius assigned to the Sun sphere (exactly). */
  sunSceneRadius?: number;
  /**
   * Radius compression exponent (>1). Applied to the in-[0,1] log-normalized
   * ratio so planets/moons shrink *toward* the Sun (bodies smaller than the
   * Sun get disproportionately smaller) while ordering stays monotonic. This
   * keeps the Sun clearly dominant and planets distinguishable from each
   * other instead of all collapsing near Sun-sized. Default 3.0.
   */
  radiusCompression?: number;
  /** Smallest rendered sphere radius (floor, protects tiny moons). */
  minSceneRadius?: number;
  /** Largest rendered sphere radius (cap, keeps Sun dominant). */
  maxSceneRadius?: number;
  /** Linear radius gain, scene units per km. Chosen so Sun maps to sunSceneRadius. */
  linearRadiusGain?: number;
}

const DEFAULTS = {
  distanceScale: "log" as DistanceScaleMode,
  radiusScale: "log" as RadiusScaleMode,
  distanceGain: 5.0,
  distanceFloorKm: 100_000,
  linearDistanceGain: 1e-9,
  sunSceneRadius: 2.2,
  radiusCompression: 3.0,
  minSceneRadius: 0.25,
  maxSceneRadius: 10.0,
  linearRadiusGain: 2.2 / 696_340.0, // Sun 696340 km -> sunSceneRadius (2.2) scene units
};

const SUN_RADIUS_KM = 696_340; // reference anchor for log radius scale

/** Clamp finite input to [low, high]; non-finite -> 0.01 fallback. */
function clampFinite(x: number, low: number, high: number): number {
  if (Number.isFinite(low) && Number.isFinite(high) && low <= high) {
    if (!Number.isFinite(x)) return low;
    return Math.min(Math.max(x, low), high);
  }
  return 0.01;
}

export class ScaleManager {
  private _opts: Required<ScaleManagerOptions>;

  constructor(opts: ScaleManagerOptions = {}) {
    this._opts = { ...DEFAULTS, ...opts };
    // Guard degenerate log floors (must stay strictly positive so log1p is finite).
    if (!(this._opts.distanceFloorKm > 0)) {
      this._opts.distanceFloorKm = 1e-6;
    }
  }

  get distanceMode(): DistanceScaleMode {
    return this._opts.distanceScale;
  }
  get radiusMode(): RadiusScaleMode {
    return this._opts.radiusScale;
  }
  /** Configured floor scene radius (visibility floor for tiny moons). */
  get minSceneRadius(): number {
    return this._opts.minSceneRadius;
  }

  setDistanceMode(mode: DistanceScaleMode): void {
    this._opts.distanceScale = mode;
  }
  setRadiusMode(mode: RadiusScaleMode): void {
    this._opts.radiusScale = mode;
  }

  /**
   * Map an actual distance (km) from the parent body to scene units.
   * Non-positive input always gives 0 so origin bodies rest at the parent.
   * Finite for any finite `km`. Monotonic non-decreasing in `km`.
   */
  distance(km: number): number {
    const d = Number.isFinite(km) && km > 0 ? km : 0;
    if (d === 0) return 0;
    if (this._opts.distanceScale === "linear") {
      return Math.max(d * this._opts.linearDistanceGain, 0);
    }
    // log: 1 + d/floor → log10; d=0 handled above; large d stays finite.
    return this._opts.distanceGain * Math.log10(1 + d / this._opts.distanceFloorKm);
  }

  /**
   * Map an actual radius (km) to a scene radius. Unknown / zero radii safely
   * return a small floor radius; the Sun radius maps exactly to
   * sunSceneRadius. Monotonic non-decreasing in `km`.
   */
  radius(km: number): number {
    const r = Number.isFinite(km) && km > 0 ? km : 0;
    if (r === 0) return clampFinite(DEFAULTS.minSceneRadius, 0, this._opts.minSceneRadius * 2);
    const low = this._opts.minSceneRadius;
    const high = this._opts.maxSceneRadius;
    if (this._opts.radiusScale === "linear") {
      return clampFinite(r * this._opts.linearRadiusGain, low, high);
    }
    // Log radius: normalize log1p(radius) by log1p(Sun) so the Sun maps
    // exactly to sunSceneRadius, then raise the in-[0,1] ratio to
    // `radiusCompression` (≥1) so planets/moons shrink toward the Sun and
    // stay clearly sub-dominant while ordering stays monotonic. Finite for
    // all r>0, deterministic, monotonic non-decreasing.
    const ratio = Math.log1p(r) / Math.log1p(SUN_RADIUS_KM);
    const compressed = Math.pow(ratio, this._opts.radiusCompression);
    return clampFinite(this._opts.sunSceneRadius * compressed, low, high);
  }
}
