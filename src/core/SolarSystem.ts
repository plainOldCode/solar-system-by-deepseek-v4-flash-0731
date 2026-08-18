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
}

export class SolarSystem {
  readonly views: SolarSystemViews;
  readonly clock: SimulationClock;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private animationId = 0;
  private lastNowMs = 0;
  private running = false;
  private disposed = false;

  constructor(
    container: HTMLElement,
    opts: SolarSystemOptions = {},
  ) {
    this.views = SolarSystem.buildViews(opts.scale ?? new ScaleManager());
    this.clock = new SimulationClock(
      opts.startSec ?? 0,
      opts.speed ?? 1,
      opts.paused ?? false,
    );

    this.scene = new THREE.Scene();
    this.scene.add(this.views.root);
    this.addLights();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.positionCamera(opts.cameraDistance);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);
  }

  static buildViews(
    scale: ScaleManager = new ScaleManager(),
  ): SolarSystemViews {
    const root = new THREE.Group();
    root.name = "solar-system";

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
      const lineParent = parent ? parent.group : root;
      const line = OrbitRenderer.buildLine(body.orbitParams, scale, undefined, data.id);
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

  /** (Re)size the viewport to the container dimensions. */
  resize(): void {
    const w = this.renderer.domElement.clientWidth || window.innerWidth;
    const h = this.renderer.domElement.clientHeight || window.innerHeight;
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
    this.renderer.render(this.scene, this.camera);
  };

  /** Move every body to its position at `timeDays`. */
  update(timeDays: number): void {
    updateBodyPositions(this.views, timeDays);
  }

  /** Stop the loop and release all GPU resources. */
  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
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
