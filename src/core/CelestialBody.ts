/**
 * CelestialBody — a Three.js mesh plus the data/scaling needed to drive it.
 *
 * Every body owns a `THREE.Group` whose position is the body's scene position.
 * For a planet/dwarf/star that group sits directly in the scene root (the Sun
 * at the origin); for a moon the group is added as a child of its parent
 * planet's group, so the parent-child transform automatically carries the moon
 * along with the planet while its own `update` adds the moon's orbital offset.
 *
 * The per-frame motion reuses `orbitalPosition` for the true-ellipse direction
 * and `ScaleManager.distance`-derived `ringSceneRadius` for the semi-major scene
 * axis, always scaled by the same linear factor the orbit guide uses — so the
 * body stays exactly on its drawn (true-ellipse) orbit path. A single reused
 * temp vector avoids per-frame allocation.
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
  /** Scene radius at which the body and its orbit line are drawn. Mutable so
   * scale-mode changes can refresh it (see recomputeRingRadius). */
  ringSceneRadius: number;

  private scale: ScaleManager;
  /** Reused to avoid per-frame allocation. */
  private readonly tmp = new THREE.Vector3();
  /** Saturn ring bands (child meshes of the star's/sphere's group). */
  private readonly rings: THREE.Mesh[] = [];
  /** Body radius used when the current Saturn ring geometry was built. */
  private saturnRingAnchorR = 0;

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
    this.ringSceneRadius = this.computeRingSceneRadius();

    this.group = new THREE.Group();
    this.group.name = data.id;
    this.group.userData.bodyId = data.id;
    this.group.userData.kind = data.type;
    this.mesh = this.buildMesh();
    this.group.add(this.mesh);
    // Saturn gets a clearly-visible ring system pinned to its sphere (moves
    // with the planet); all other bodies have none.
    if (data.id === "saturn") this.addSaturnRings();
  }

  /**
   * Build Saturn's ring system as concentric bands whose inner/outer edges are
   * proportionally true to the real C / B / A rings (radii given in km, scaled
   * to hug this body's own render radius). The Cassini division (gap between
   * B and A) stays visible as the bright band is split from the outer one.
   */
  private addSaturnRings(): void {
    const R = this.scale.radius(this.data.radiusKm);
    this.saturnRingAnchorR = R;
    const saturnRadiusKm = 58_232; // dataset radiusKm; used as the scale anchor
    const toScene = (km: number) => R * (km / saturnRadiusKm);
    const bands = [
      // [innerKm, outerKm, color, opacity] — real ring structure
      [74_860, 92_000, 0xd8c9a0, 0.55], // C ring (faint, inner)
      [92_000, 117_580, 0xf0e2bb, 0.8], // B ring (bright, widest)
      [122_170, 136_780, 0xd8c9a0, 0.7], // A ring (outer, past the division)
    ] as const;

    for (const [innerKm, outerKm, color, opacity] of bands) {
      const geo = new THREE.RingGeometry(toScene(innerKm), toScene(outerKm), 96, 1);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.name = "saturn-ring";
      // RingGeometry lies in the XY plane — lay it flat (XZ) then apply the
      // planet's axial tilt so the rings read as a tilted disc in 3D.
      ring.rotation.x = -Math.PI / 2;
      const tilt = (this.data.axialTiltDeg ?? 26.73) * (Math.PI / 180);
      ring.rotation.z = tilt;
      this.group.add(ring);
      this.rings.push(ring);
    }
  }

  private computeSemiMajorAxisKm(): number {
    const b = this.data;
    if (b.semiMajorAxis === undefined) return 0;
    return b.semiMajorAxisUnit === "AU" ? b.semiMajorAxis * AU_KM : b.semiMajorAxis;
  }

  private buildMesh(): THREE.Mesh {
    const sceneRadius = this.scale.radius(this.data.radiusKm);
    const geo = new THREE.SphereGeometry(sceneRadius, 24, 16);
    // Stars are self-illuminated (emissive): render them with an unlit,
    // full-brightness material so the Sun is visibly the brightest object.
    // Everything else keeps a lit Lambert material so the Sun's PointLight
    // still shapes the correct daylight on planets and moons.
    let mat: THREE.Material;
    if (this.data.type === "star") {
      // self-illuminated full-brightness star. fog:false keeps the black space
      // fog (camera ~50 units out, fog band 40→90) from dimming the Sun toward
      // black — it must read as the luminous source, not fade.
      mat = new THREE.MeshBasicMaterial({
        color: this.data.displayColor,
        fog: false,
      });
    } else {
      // Everything else keeps a lit Lambert material so the Sun's PointLight
      // still shapes the correct daylight on planets and moons.
      mat = new THREE.MeshLambertMaterial({ color: this.data.displayColor });
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = this.data.id;
    mesh.userData.bodyId = this.data.id;
    mesh.userData.kind = this.data.type;
    return mesh;
  }

  /**
   * Move the body to its simulated orbit position at `timeDays`. Sun/static
   * bodies (no semi-major axis) resolve to the origin. Deterministic for a
   * given body and time, so the visual is reproducible. Uses the same linear
   * scale factor as the orbit guide (ringSceneRadius / semiMajorAxis), so the
   * sphere rides exactly on its drawn true-ellipse path with the parent at the
   * focus.
   */
  update(timeDays: number): void {
    const a = this.semiMajorAxisKm;
    if (a > 0) {
      const p = orbitalPosition(this.orbitParams, timeDays).position;
      const k = this.ringSceneRadius / a;
      this.tmp.set(p.x * k, p.y * k, p.z * k);
    } else {
      // Star / no-orbit body: rest at the parent origin.
      this.tmp.set(0, 0, 0);
    }
    this.group.position.copy(this.tmp);
  }

  /**
   * Heliocentric bodies scale by the mode-aware global distance mapping; moons
   * use the always-local mapping so focus re-anchoring never distorts their
   * parent-relative orbits. Shared with OrbitRenderer so body and guide use the
   * same semi-major scene radius.
   */
  private computeRingSceneRadius(): number {
    return this.data.type === "moon"
      ? this.scale.localDistance(this.semiMajorAxisKm)
      : this.scale.distance(this.semiMajorAxisKm);
  }

  /** Re-derive the orbit-ring radius from the live scale (after a mode change). */
  recomputeRingRadius(): void {
    this.ringSceneRadius = this.computeRingSceneRadius();
  }

  /** Current drawn sphere radius in scene units (used for labels/focus framing). */
  get sceneRadius(): number {
    const params = (this.mesh.geometry as THREE.SphereGeometry).parameters;
    return typeof params.radius === "number" && Number.isFinite(params.radius)
      ? params.radius
      : 1;
  }

  /**
   * Rebuild the sphere geometry (and rescale any Saturn rings) to match the
   * live size mode. Disposes the old geometry so GPU memory isn't leaked.
   */
  rebuildSphereRadius(): void {
    const r = this.scale.radius(this.data.radiusKm);
    const geo = new THREE.SphereGeometry(r, 24, 16);
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
    this.mesh.geometry = geo;
    if (this.rings.length > 0) {
      const anchor = this.saturnRingAnchorR > 0 ? this.saturnRingAnchorR : r;
      const factor = r / anchor;
      for (const ring of this.rings) ring.scale.multiplyScalar(factor);
      this.saturnRingAnchorR = r;
    }
  }

  /** Release GPU resources owned by this body (geometry + material). */
  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
