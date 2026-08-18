/**
 * CelestialBody — a Three.js mesh plus the data/scaling needed to drive it.
 *
 * Every body owns a `THREE.Group` whose position is the body's scene position.
 * For a planet/dwarf/star that group sits directly in the scene root (the Sun
 * at the origin); for a moon the group is added as a child of its parent
 * planet's group, so the parent-child transform automatically carries the moon
 * along with the planet while its own `update` adds the moon's orbital offset.
 *
 * The per-frame motion reuses `orbitalPosition` for the direction and
 * `ScaleManager.distance` for the magnitude, so the body always stays exactly
 * on its drawn orbit ring. A single reused temp vector avoids per-frame
 * allocation.
 */

import * as THREE from "three";
import type { CelestialBodyData } from "../data/types";
import { AU_KM, ScaleManager } from "./ScaleManager";
import { orbitalPosition, type OrbitParams } from "./orbit";

/**
 * Deterministic phase seed (degrees) from a body id string, so planets/moons
 * don't all start aligned at perihelion but the spread is reproducible.
 */
function seedPhaseDeg(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 3600) / 10; // [0, 360)
}

export class CelestialBody {
  readonly data: CelestialBodyData;
  readonly group: THREE.Group;
  readonly mesh: THREE.Mesh;
  /** Real semi-major axis from the parent in km (AU converted via AU_KM). */
  readonly semiMajorAxisKm: number;
  readonly orbitParams: OrbitParams;
  /** Scene radius at which the body and its orbit line are drawn. */
  readonly ringSceneRadius: number;

  private scale: ScaleManager;
  /** Reused to avoid per-frame allocation. */
  private readonly tmp = new THREE.Vector3();

  constructor(
    data: CelestialBodyData,
    scale: ScaleManager = new ScaleManager(),
  ) {
    this.data = data;
    this.scale = scale;
    this.semiMajorAxisKm = this.computeSemiMajorAxisKm();
    this.orbitParams = {
      semiMajorAxisKm: this.semiMajorAxisKm,
      periodDays: data.orbitalPeriodDays ?? 0,
      eccentricity: data.eccentricity ?? 0,
      inclinationDeg: data.inclinationDeg ?? 0,
      initialPhaseDeg: seedPhaseDeg(data.id),
    };
    this.ringSceneRadius = scale.distance(this.semiMajorAxisKm);

    this.group = new THREE.Group();
    this.group.name = data.id;
    this.group.userData.bodyId = data.id;
    this.group.userData.kind = data.type;
    this.mesh = this.buildMesh();
    this.group.add(this.mesh);
  }

  private computeSemiMajorAxisKm(): number {
    const b = this.data;
    if (b.semiMajorAxis === undefined) return 0;
    return b.semiMajorAxisUnit === "AU" ? b.semiMajorAxis * AU_KM : b.semiMajorAxis;
  }

  private buildMesh(): THREE.Mesh {
    const sceneRadius = this.scale.radius(this.data.radiusKm);
    const geo = new THREE.SphereGeometry(sceneRadius, 24, 16);
    const mat = new THREE.MeshLambertMaterial({ color: this.data.displayColor });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = this.data.id;
    mesh.userData.bodyId = this.data.id;
    mesh.userData.kind = this.data.type;
    return mesh;
  }

  /**
   * Move the body to its simulated orbit position at `timeDays`. Sun/static
   * bodies (no semi-major axis) resolve to the origin. Deterministic for a
   * given body and time, so the visual is reproducible.
   */
  update(timeDays: number): void {
    const p = orbitalPosition(this.orbitParams, timeDays).position;
    const len = Math.hypot(p.x, p.y, p.z) || 1;
    const r = this.ringSceneRadius;
    this.tmp.set((p.x / len) * r, (p.y / len) * r, (p.z / len) * r);
    this.group.position.copy(this.tmp);
  }

  /** Release GPU resources owned by this body (geometry + material). */
  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
