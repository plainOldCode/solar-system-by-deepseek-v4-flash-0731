/**
 * SolarSystem — the Three.js scene, lights, animation loop, and composition of
 * the celestial bodies into the parent-child (planet → moon) hierarchy.
 *
 * Construction is split so the scene graph (`buildViews`) is independent of
 * the WebGL renderer: `buildViews` is a pure, dependency-free (in three's
 * sense — no `WebGLRenderer` needed) helper that returns the root group and
 * body map, which unit tests exercise directly. `SolarSystem` wraps that with
 * a renderer, camera, lights, and a single requestAnimationFrame loop.
 */

import * as THREE from "three";
import { ScaleManager } from "./ScaleManager";
import { SimulationClock } from "./SimulationClock";
import { CelestialBody } from "./CelestialBody";
import { OrbitRenderer } from "./OrbitRenderer";
import {
  StarField,
  STAR_COUNT,
  STAR_COUNT_MOBILE,
  STAR_FIELD_RADIUS,
} from "./StarField";
import { SOLAR_SYSTEM } from "../data/solarSystemData";

export interface SolarSystemViews {
  /** Root group centred on the Sun at the origin. */
  root: THREE.Group;
  /** Full body map keyed by body id, including `sun`. */
  byId: Map<string, CelestialBody>;
  /** Every body except the `sun` (walk order is authoritative for layering). */
  bodies: CelestialBody[];
  /** Sun body (star); kept separately for lighting / tests. */
  sun: CelestialBody;
  /** Orbit guide lines, keyed by body id, parent-local. */
  lines: THREE.Line[];
}

export interface SolarSystemOptions {
  scale?: ScaleManager;
  /** Initial simulated time in seconds. */
  startSec?: number;
  speed?: number;
  paused?: boolean;
  /** Camera distance/height overrides. */
  cameraDistance?: number;
  /**
   * Pre-built camera to use instead of creating one internally. Lets an
   * interaction layer (e.g. CameraRig) supply the camera that both the rig's
   * OrbitControls and the scene's renderer share.
   */
  camera?: THREE.PerspectiveCamera;
  /**
   * Optional per-frame hook called right before rendering, after bodies have
   * been moved. Lets interaction layers (camera rigs, selection following)
   * update without owning or forking the animation loop.
   */
  onFrame?: (timeDays: number, dtSec: number) => void;
}

export class SolarSystem {
  readonly views: SolarSystemViews;
  readonly clock: SimulationClock;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  /** Procedural background star field (visibility toggleable). */
  readonly starField: StarField;

  private readonly scale: ScaleManager;
  private animationId = 0;
  private lastNowMs = 0;
  private running = false;
  private disposed = false;
  private readonly opts: SolarSystemOptions;

  constructor(
    container: HTMLElement,
    opts: SolarSystemOptions = {},
  ) {
    this.opts = opts;
    this.scale = opts.scale ?? new ScaleManager();
    this.views = SolarSystem.buildViews(this.scale);
    this.clock = new SimulationClock(
      opts.startSec ?? 0,
      opts.speed ?? 1,
      opts.paused ?? false,
    );

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.add(this.views.root);
    this.addLights();

    // Star field reduced on narrow/mobile viewports (prompt §16). The Points
    // geometry is built once here, never per-frame.
    const isMobile =
      (window.innerWidth || window.innerHeight || 0) < 760;
    this.starField = new StarField({
      count: isMobile ? STAR_COUNT_MOBILE : STAR_COUNT,
      radius: STAR_FIELD_RADIUS,
    });
    this.scene.add(this.starField.points);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera =
      opts.camera ?? new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.aspect = width / height; // keep in sync even when injected
    this.positionCamera(opts.cameraDistance);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    // Cap devicePixelRatio at 2 (spec §16) so 4k/retina screens don't render at
    // 4x the fragment cost — SwiftShader / high-DPR performance stays bounded.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);
  }

  static buildViews(
    scale: ScaleManager = new ScaleManager(),
  ): SolarSystemViews {
    const root = new THREE.Group();
    root.name = "solar-system";
    // The orbital simulation (orbit.ts orbitalPosition) lays orbits out in the
    // X–Y plane — planeX along X, planeY along Y, with inclination rotating
    // that in-plane component toward Z. Rotate the whole scene root −90° about
    // X so the Y-up axis becomes the orbit-plane normal and the system reads
    // as a familiar horizontal, plane-like disc instead of an edge-on vertical
    // plane. Every body, orbit line and moon hangs off `root`, so they all
    // inherit this reorientation automatically and selection/focus reads each
    // body's world position through the same transform, keeping tracking exact.
    root.rotation.x = -Math.PI / 2;

    const byId = new Map<string, CelestialBody>();
    const bodies: CelestialBody[] = [];
    const lines: THREE.Line[] = [];

    let sun: CelestialBody | undefined;
    for (const data of SOLAR_SYSTEM) {
      if (data.id === "sun") {
        sun = new CelestialBody(data, scale);
        root.add(sun.group);
        byId.set(data.id, sun);
        continue;
      }
      // Parent is the sun by default; moons hang off their planet's group.
      const parent = data.parentId ? byId.get(data.parentId) : undefined;
      const attachGroup = parent ? parent.group : root;
      const body = new CelestialBody(data, scale);
      attachGroup.add(body.group);
      byId.set(data.id, body);
      bodies.push(body);

      // Orbit guide line centred on the parent (root origin for heliocentric).
      // Use the body's precomputed ring radius (moon-local vs global) so the
      // line always matches the sphere exactly.
      const lineParent = parent ? parent.group : root;
      const line = OrbitRenderer.buildLine(
        body.orbitParams,
        body.ringSceneRadius,
        undefined,
        data.id,
      );
      lineParent.add(line);
      lines.push(line);
    }

    if (!sun) throw new Error("Dataset missing 'sun' body");
    return { root, byId, bodies, sun, lines };
  }

  private addLights(): void {
    this.scene.add(new THREE.AmbientLight(0x334466, 0.5));
    // Point light at the Sun illuminates the hemispheres of planets facing it.
    const sunLight = new THREE.PointLight(0xffffff, 800, 0, 2);
    sunLight.position.set(0, 0, 0);
    this.scene.add(sunLight);
    // Soft top-down directional light so far sides aren't pure black.
    this.scene.add(new THREE.DirectionalLight(0x556688, 0.4));
    // Slight fog/tone for depth.
    this.scene.fog = new THREE.Fog(0x000000, 40, 90);
  }

  private positionCamera(distance?: number): void {
    const d = distance ?? 42;
    this.camera.position.set(0, d * 0.68, d);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * (Re)size the viewport. Pass the host container's CSS dimensions: reading
   * the canvas's own clientWidth is wrong because `renderer.setSize` writes an
   * inline `style.width` on the canvas that overrides the CSS `canvas{width:
   * 100%}` rule, so the canvas's clientWidth always reflects the last known
   * pixel size and resizing can never shrink the buffer (it just re-applies
   * the old size). The AppController, which owns the container, passes the
   * real CSS dimensions.
   */
  resize(width?: number, height?: number): void {
    const w = width ?? (this.renderer.domElement.clientWidth || window.innerWidth);
    const h = height ?? (this.renderer.domElement.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** Start (or resume) the animation loop. Idempotent-safe. */
  start(): this {
    if (this.running || this.disposed) return this;
    this.running = true;
    this.lastNowMs = performance.now();
    this.tick(this.lastNowMs);
    return this;
  }

  /** Stop the animation loop without disposing resources (idempotent). */
  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
    this.running = false;
  }

  private tick = (nowMs: number): void => {
    if (!this.running || this.disposed) return;
    this.animationId = requestAnimationFrame(this.tick);
    const dtMs = nowMs - this.lastNowMs;
    this.lastNowMs = nowMs;
    const dtSec = Math.max(0, Math.min(dtMs, 250)) / 1000; // clamp big tab-switch jumps
    this.clock.advance(dtSec);
    this.update(this.clock.timeDays);
    this.opts.onFrame?.(this.clock.timeDays, dtSec);
    this.renderer.render(this.scene, this.camera);
  };

  /** Move every body to its position at `timeDays`. */
  update(timeDays: number): void {
    updateBodyPositions(this.views, timeDays);
  }

  /* ── scale-mode & visibility controls (wired from the UI) ──────── */

  get distanceMode(): ScaleManager["distanceMode"] {
    return this.scale.distanceMode;
  }
  get sizeMode(): ScaleManager["radiusMode"] {
    return this.scale.radiusMode;
  }

  /** Switch the global distance mapping; refreshes every ring + body. */
  setDistanceMode(mode: import("./ScaleManager").DistanceScaleMode): void {
    this.scale.setDistanceMode(mode);
    this.refreshScale();
  }

  /** Switch the body-size mapping; refreshes every sphere + ring. */
  setSizeMode(mode: import("./ScaleManager").RadiusScaleMode): void {
    this.scale.setRadiusMode(mode);
    this.refreshScale();
  }

  /**
   * Set the focus reference (heliocentric km of the selected system) for focus
   * mode. Only triggers a refresh while focus mode is active.
   */
  setFocusKm(km: number | null): void {
    this.scale.setFocusKm(km);
    if (this.scale.distanceMode === "focus") this.refreshScale();
  }

  /** Show/hide every orbit guide line (heliocentric + moon). */
  setOrbitsVisible(visible: boolean): void {
    setOrbitsVisibility(this.views, visible);
  }

  /** Show/hide all moon bodies, their orbit lines and their labels. */
  setMoonsVisible(visible: boolean): void {
    setMoonsVisibility(this.views, visible);
  }

  /** Show/hide the procedural star field. */
  setStarsVisible(visible: boolean): void {
    this.starField.setVisible(visible);
  }

  /**
   * Rebuild all bodies and rings for the live scale (called after any
   * scale-mode or focus change). Keeps the body-sphere/ring coincidence and
   * re-positions every body at the current simulated time.
   */
  private refreshScale(): void {
    refreshViews(this.views, this.clock.timeDays);
  }

  /** Stop the loop and release all GPU resources. */
  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.starField.dispose();
    this.views.sun.dispose();
    for (const body of this.views.bodies) body.dispose();
    for (const line of this.views.lines) OrbitRenderer.dispose(line);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/**
 * Pure scene update: move every body to its simulated position at `timeDays`.
 * Kept separate from the render infra so tests and headless consumers can
 * drive the scene graph directly without a WebGLRenderer.
 */
export function updateBodyPositions(
  views: SolarSystemViews,
  timeDays: number,
): void {
  for (const body of views.bodies) body.update(timeDays);
  views.sun.update(timeDays); // star stays at origin, but keep it symmetric
}

/**
 * Pure scene refresh for a live scale change: recompute each body's ring
 * radius, rebuild every sphere/ring geometry and re-tessellate each orbit
 * line, then re-position all bodies at the current simulated time. Mirrors
 * `updateBodyPositions` as a headless-testable helper (no WebGLRenderer).
 */
export function refreshViews(
  views: SolarSystemViews,
  timeDays: number,
): void {
  const all = [views.sun, ...views.bodies];
  for (const body of all) {
    body.recomputeRingRadius();
    body.rebuildSphereRadius();
  }
  for (const line of views.lines) {
    const owner = views.byId.get(line.userData.bodyId as string);
    if (owner) {
      OrbitRenderer.replaceGeometry(line, owner.orbitParams, owner.ringSceneRadius);
    }
  }
  for (const body of all) body.update(timeDays);
}

/** Show/hide every orbit guide line (heliocentric + moon). Pure + headless. */
export function setOrbitsVisibility(
  views: SolarSystemViews,
  visible: boolean,
): void {
  for (const line of views.lines) line.visible = visible;
}

/** Show/hide all moon bodies and their orbit lines (not planet lines). */
export function setMoonsVisibility(
  views: SolarSystemViews,
  visible: boolean,
): void {
  for (const body of views.bodies) {
    if (body.data.type !== "moon") continue;
    body.group.visible = visible; // body sphere
  }
  for (const line of views.lines) {
    const owner = views.byId.get(line.userData.bodyId as string);
    if (owner?.data.type === "moon") line.visible = visible;
  }
}
