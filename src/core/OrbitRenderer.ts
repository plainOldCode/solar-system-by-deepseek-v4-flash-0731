/**
 * OrbitRenderer — builds true-ellipse orbit-path lines (the drawn guides) from
 * the existing deterministic orbital simulation and log scaling APIs.
 *
 * It does NOT re-implement formulas: it samples `orbitalPosition` (which holds
 * the Keplerian math) across one full period and linearly scales each sample
 * into scene space so the guide is a *true* ellipse — same eccentricity, same
 * inclination, with the parent body at the focus — whose semi-major axis equals
 * the body's mode-aware `ringSceneRadius`. Both the ring and the moving body use
 * the exact same linear scale factor, so the sphere always travels precisely
 * along its drawn guide. The ring radius is passed in (not derived internally)
 * so moons can use their local scale and heliocentric bodies their global scale
 * without duplicating that choice here.
 */

import * as THREE from "three";
import { orbitalPosition, type OrbitParams } from "./orbit";

/** Number of segments used to tessellate an orbit path. */
export const ORBIT_SEGMENTS = 256;
/** Opacity of the planet/dwarf orbit lines (fainter than the bodies so they read as guides). */
export const ORBIT_LINE_OPACITY = 0.35;
/** Default orbit line colour (a dim blue-grey). */
export const ORBIT_COLOR = "#7788aa";
/**
 * Opacity of moon orbit lines when their parent system is NOT focused (§5/§13:
 * "hide or greatly reduce the opacity of moon orbit lines in the full view").
 * Faint but still present so moons read as belonging to their planet.
 */
export const MOON_ORBIT_FAINT_OPACITY = 0.12;
/** Opacity of a focused system's moon orbits — reveal/enlarge on selection. */
export const MOON_ORBIT_EMPHASIZED_OPACITY = 0.65;
/** Opacity + colour of the selected body's own orbit — the clear highlight. */
export const SELECTED_ORBIT_OPACITY = 0.95;
export const SELECTED_ORBIT_COLOR = "#ffcf6e";
/** Opacity of non-selected heliocentric guide lines while something is selected. */
export const UNSELECTED_ORBIT_OPACITY = 0.14;

export class OrbitRenderer {
  /**
   * Linear scene-scale factor for an orbit: maps its real semi-major axis to
   * `ringSceneRadius`, so the drawn path is a true (affinely-scaled) ellipse —
   * eccentricity and inclination are preserved exactly and the parent body stays
   * at the focus. Degenerate orbits (no semi-major axis) fall back to 1.
   */
  static scaleFactor(
    orbit: OrbitParams,
    ringSceneRadius: number,
  ): number {
    const a = orbit.semiMajorAxisKm;
    if (!(a > 0) || !Number.isFinite(a) || !(ringSceneRadius > 0)) return 1;
    return ringSceneRadius / a;
  }

  /**
   * Build a closed THREE.Line orbit path at the given scene radius for the
   * body's real semi-major-axis eccentricity/inclination. The line is centred
   * on the parent body's local origin (the focus), so it is attached to the
   * parent's group (or the scene root for heliocentric bodies).
   */
  static buildLine(
    orbit: OrbitParams,
    ringSceneRadius: number,
    color: string = ORBIT_COLOR,
    bodyId?: string,
  ): THREE.Line {
    const geo = OrbitRenderer.buildGeometry(orbit, ringSceneRadius);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: ORBIT_LINE_OPACITY,
    });
    const line = new THREE.Line(geo, mat);
    line.name = "orbit";
    line.userData.bodyId = bodyId;
    return line;
  }

  /** Build the orbit path BufferGeometry closed around `ringSceneRadius`. */
  static buildGeometry(
    orbit: OrbitParams,
    ringSceneRadius: number,
  ): THREE.BufferGeometry {
    const period = orbit.periodDays > 0 ? orbit.periodDays : 1;
    const k = OrbitRenderer.scaleFactor(orbit, ringSceneRadius);
    const pts: THREE.Vector3[] = new Array(ORBIT_SEGMENTS + 1);
    for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
      const t = (i / ORBIT_SEGMENTS) * period;
      const p = orbitalPosition(orbit, t).position;
      pts[i] = new THREE.Vector3(p.x * k, p.y * k, p.z * k);
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }

  /**
   * Re-tessellate an existing orbit line's geometry in place for a new
   * ring radius (scale-mode change). The THREE.Line object is preserved so
   * identity, parentage, userData and raycast selection all survive.
   */
  static replaceGeometry(
    line: THREE.Line,
    orbit: OrbitParams,
    ringSceneRadius: number,
  ): void {
    const geo = OrbitRenderer.buildGeometry(orbit, ringSceneRadius);
    line.geometry.dispose();
    line.geometry = geo;
  }

  /** Set the opacity of a line's material in place (no re-allocation). */
  static setOpacity(line: THREE.Line, opacity: number): void {
    const mat = line.material as THREE.LineBasicMaterial | undefined;
    if (mat) mat.opacity = opacity;
  }

  /** Release GPU resources held by a line created by {@link buildLine}. */
  static dispose(line: THREE.Line): void {
    line.geometry?.dispose();
    const mat = line.material as THREE.Material | undefined;
    mat?.dispose();
  }
}
