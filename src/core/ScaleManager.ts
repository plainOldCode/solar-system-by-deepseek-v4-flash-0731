/**
 * ScaleManager — logarithmic / linear scaling of real astronomical distances
 * and radii into scene units, plus a focus distance mode and three body-size
 * modes.
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
 *
 * Heliocentric (planet/dwarf) bodies use `distance`; moon orbits use
 * `localDistance` so the focus mode re-anchoring of the heliocentric scale can
 * never blow up planetocentric moon orbits. This keeps the moon-system local
 * scale constant regardless of the active distance mode.
 */

/** One astronomical unit in kilometres (IAU 2012 def). */
export const AU_KM = 149_597_870.7;

/** Selectable distance modes (prompt §4): log (default), linear, focus. */
export type DistanceScaleMode = "log" | "linear" | "focus";

/** Selectable body-size modes (prompt §6): enhanced (default), relative, uniform. */
export type RadiusScaleMode = "enhanced" | "relative" | "uniform";

export interface ScaleManagerOptions {
  /** Distance mapping mode. Default "log". */
  distanceScale?: DistanceScaleMode;
  /** Body-size mapping mode. Default "enhanced". */
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
   * other instead of all collapsing near Sun-sized. Default 3.6 (raised from
   * 3.0 so terrestrial/giant planets read as compact orbit markers — each
   * ~2–5% of its orbit radius — with the Sun unmistakably the largest).
   */
  radiusCompression?: number;
  /** Smallest rendered sphere radius (floor, protects tiny moons). */
  minSceneRadius?: number;
  /** Largest rendered sphere radius (cap, keeps Sun dominant). */
  maxSceneRadius?: number;
  /** Linear radius gain, scene units per km. Chosen so Sun maps to sunSceneRadius. */
  linearRadiusGain?: number;

  /**
   * Focus mode only — the scene radius the focused body's real distance maps
   * to exactly (the local "centre" of the focused planetary system).
   */
  focusTargetRadius?: number;
  /** Focus mode — scene-units range either side of the target at saturation. */
  focusMagnify?: number;
  /** Focus mode — log-decades over which the magnification acts (tanh scale). */
  focusSpreadDecades?: number;

  /** Relative size mode — visibility floor so tiny bodies stay visible. */
  relativeMinSceneRadius?: number;
  /** Uniform size mode — marker radius for every non-Sun body. */
  uniformMarkerRadius?: number;
  /** Uniform size mode — marker radius for the Sun (kept a touch larger). */
  uniformSunMarkerRadius?: number;

  /** Internal: reference km (heliocentric) the focus mode centres on. 0 = none. */
  focusKm?: number;
}

const DEFAULTS = {
  distanceScale: "log" as DistanceScaleMode,
  radiusScale: "enhanced" as RadiusScaleMode,
  distanceGain: 5.0,
  distanceFloorKm: 100_000,
  linearDistanceGain: 1e-9,
  sunSceneRadius: 2.2,
  radiusCompression: 3.6,
  minSceneRadius: 0.25,
  maxSceneRadius: 10.0,
  linearRadiusGain: 2.2 / 696_340.0, // Sun 696340 km -> sunSceneRadius (2.2) scene units
  focusTargetRadius: 45,
  focusMagnify: 20,
  focusSpreadDecades: 0.6,
  relativeMinSceneRadius: 0.1,
  uniformMarkerRadius: 1.0,
  uniformSunMarkerRadius: 1.5,
  focusKm: 0,
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
  /** Alias for `radiusMode` — the user-facing "size" scale. */
  get sizeMode(): RadiusScaleMode {
    return this._opts.radiusScale;
  }
  /** Configured floor scene radius (visibility floor for tiny moons). */
  get minSceneRadius(): number {
    return this._opts.minSceneRadius;
  }
  /** Current focus reference km in the distance mapping (0 = none). */
  get focusKm(): number {
    return this._opts.focusKm;
  }

  setDistanceMode(mode: DistanceScaleMode): void {
    this._opts.distanceScale = mode;
  }
  setRadiusMode(mode: RadiusScaleMode): void {
    this._opts.radiusScale = mode;
  }
  /**
   * Set the heliocentric reference for focus mode. Pass 0/null to disable the
   * focused centre (focus mode then falls back to log). Plain data, computed
   * by the interaction layer from the selected body.
   */
  setFocusKm(km: number | null): void {
    this._opts.focusKm =
      typeof km === "number" && Number.isFinite(km) && km > 0 ? km : 0;
  }

  /**
   * Map an actual heliocentric distance (km) from the Sun to scene units.
   * Non-positive input always gives 0 so origin bodies rest at the parent.
   * Finite for any finite `km`. Monotonic non-decreasing in `km` in every mode.
   */
  distance(km: number): number {
    const d = Number.isFinite(km) && km > 0 ? km : 0;
    if (d === 0) return 0;
    switch (this._opts.distanceScale) {
      case "linear":
        return Math.max(d * this._opts.linearDistanceGain, 0);
      case "focus":
        return this.focusDistance(d);
      default:
        return this.logDistance(d);
    }
  }

  /**
   * Map a planetocentric moon distance (km from its parent planet) to scene
   * units. Always uses the plain log mapping — never the focus re-anchor — so
   * moon orbits stay compact and parent-local no matter the global mode.
   */
  localDistance(km: number): number {
    const d = Number.isFinite(km) && km > 0 ? km : 0;
    if (d === 0) return 0;
    return this.logDistance(d);
  }

  /**
   * Map an actual radius (km) to a scene radius. Unknown / zero radii safely
   * return a small floor radius; the Sun radius maps exactly to
   * sunSceneRadius in every mode. Monotonic non-decreasing in `km`.
   */
  radius(km: number): number {
    const r = Number.isFinite(km) && km > 0 ? km : 0;
    if (r === 0) return clampFinite(DEFAULTS.minSceneRadius, 0, this._opts.minSceneRadius * 2);
    const low = this._opts.minSceneRadius;
    const high = this._opts.maxSceneRadius;
    switch (this._opts.radiusScale) {
      case "relative":
        // Proportional to real radius (gain anchored so the Sun maps exactly
        // to sunSceneRadius), floored so tiny bodies stay visible. This is the
        // "stronger emphasis on real size ratios" mode — giant planets clearly
        // outgrow terrestrial bodies, which fall to the visibility floor.
        return clampFinite(
          r * this._opts.linearRadiusGain,
          this._opts.relativeMinSceneRadius,
          high,
        );
      case "uniform":
        // "Uniform Markers": every body is a similar marker size; the Sun is
        // kept only slightly larger so it stays recognizable. Satellite/planet
        // distinction is conveyed by colour/emissivity, not size.
        return clampFinite(
          r >= SUN_RADIUS_KM
            ? this._opts.uniformSunMarkerRadius
            : this._opts.uniformMarkerRadius,
          low,
          high,
        );
      default: {
        // Enhanced Visibility (default): log radius. Normalize log1p(radius)
        // by log1p(Sun) so the Sun maps exactly to sunSceneRadius, then raise
        // the in-[0,1] ratio to `radiusCompression` (>=1) so planets/moons
        // shrink toward the Sun and stay clearly sub-dominant while ordering
        // stays monotonic. Finite for all r>0, deterministic, monotonic.
        const ratio = Math.log1p(r) / Math.log1p(SUN_RADIUS_KM);
        const compressed = Math.pow(ratio, this._opts.radiusCompression);
        return clampFinite(this._opts.sunSceneRadius * compressed, low, high);
      }
    }
  }

  /** Plain log-distance mapping (shared by local + global log modes). */
  private logDistance(km: number): number {
    return this._opts.distanceGain * Math.log10(1 + km / this._opts.distanceFloorKm);
  }

  /**
   * Focus mode: local scale centred on the selected planetary system. Re-anchor
   * the heliocentric log scale onto the focused body's real distance so that
   * body maps exactly to `focusTargetRadius`; tanh spreads nearby neighbours
   * apart (they stay readable) while bodies far from the focus compress toward
   * the saturation edges. Monotonic in km; smooth; deterministic.
   */
  private focusDistance(km: number): number {
    const f = this._opts.focusKm;
    if (!(f > 0)) return this.logDistance(km);
    const t = Math.log10(Math.max(km, 1e-9) / f);
    const y =
      this._opts.focusTargetRadius +
      this._opts.focusMagnify * Math.tanh(t / this._opts.focusSpreadDecades);
    return Math.max(y, 0);
  }
}
