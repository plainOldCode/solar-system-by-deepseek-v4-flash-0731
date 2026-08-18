/**
 * OrbitRenderer — builds logarithmic orbit-path lines (the drawn rings) from
 * the existing deterministic orbital simulation and log scaling APIs.
 *
 * It does NOT re-implement formulas: it samples `orbitalPosition` (which holds
 * the Keplerian math) across one full period and places each sample at the
 * scene radius produced by `ScaleManager.distance` for the body's real
 * semi-major axis. Because both the ring and the moving body use the same
 * mapping, the sphere always travels exactly along its drawn ring.
 */

import * as THREE from "three";
import { orbitalPosition, type OrbitParams } from "./orbit";
import type { ScaleManager } from "./ScaleManager";

/** Number of segments used to tessellate an orbit path. */
export const ORBIT_SEGMENTS = 256;
/** Opacity of the orbit lines (fainter than the bodies so they read as guides). */
export const ORBIT_LINE_OPACITY = 0.35;
/** Default orbit line colour (a dim blue-grey). */
export const ORBIT_COLOR = "#7788aa";

export class OrbitRenderer {
  /**
   * Build a closed THREE.Line orbit path at the log-scaled radius for the
   * body's real semi-major axis. The line is centred on the parent body's
   * local origin, so it is attached to the parent's group (or the scene root
   * for heliocentric bodies).
   */
  static buildLine(
    orbit: OrbitParams,
    scale: Pick<ScaleManager, "distance">,
    color: string = ORBIT_COLOR,
    bodyId?: string,
  ): THREE.Line {
    const period = orbit.periodDays > 0 ? orbit.periodDays : 1;
    const ringSceneR = scale.distance(orbit.semiMajorAxisKm);
    const pts: THREE.Vector3[] = new Array(ORBIT_SEGMENTS + 1);
    for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
      const t = (i / ORBIT_SEGMENTS) * period;
      const p = orbitalPosition(orbit, t).position;
      const len = Math.hypot(p.x, p.y, p.z) || 1;
      pts[i] = new THREE.Vector3(
        (p.x / len) * ringSceneR,
        (p.y / len) * ringSceneR,
        (p.z / len) * ringSceneR,
      );
    }

    const geo = new THREE.BufferGeometry().setFromPoints(pts);
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

  /** Release GPU resources held by a line created by {@link buildLine}. */
  static dispose(line: THREE.Line): void {
    line.geometry?.dispose();
    const mat = line.material as THREE.Material | undefined;
    mat?.dispose();
  }
}
