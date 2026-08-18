/**
 * CameraRig — owns the orbit camera, orbit controls, and the "focus / follow
 * a body" behaviour for the interaction layer.
 *
 * The rig never forks the render loop: the AppController drives it each frame
 * through SolarSystem's `onFrame` hook → `rig.update()`, so orbit damping and
 * body-following stay in sync with the scene's single requestAnimationFrame.
 *
 * A follow target is read from its world position every update, which keeps
 * the orbit pivot locked onto a moving planet/moon so the user can spin the
 * view around it while the simulation runs.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface CameraRigOptions {
  fov?: number;
  near?: number;
  far?: number;
  /** Resting view position (orbit centre = origin). */
  homePosition?: THREE.Vector3;
  minDistance?: number;
  maxDistance?: number;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  controls: OrbitControls;

  private homePos: THREE.Vector3;
  private followTarget: { getWorldPosition: (out: THREE.Vector3) => THREE.Vector3 } | null = null;
  private readonly tmp = new THREE.Vector3();

  constructor(
    domElement: HTMLElement,
    aspect: number,
    opts: CameraRigOptions = {},
  ) {
    this.camera = new THREE.PerspectiveCamera(
      opts.fov ?? 50,
      aspect,
      opts.near ?? 0.1,
      opts.far ?? 2000,
    );
    this.homePos = (opts.homePosition ?? new THREE.Vector3(0, 28, 42)).clone();
    this.camera.position.copy(this.homePos);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = opts.minDistance ?? 1;
    this.controls.maxDistance = opts.maxDistance ?? 400;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /** Recompute the projection when the viewport aspect changes. */
  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Recreate OrbitControls bound to the real WebGL canvas instead of the
   * wrapper container. When the controls listen on the whole container, any
   * pointerdown — including on the control-bar buttons — calls
   * setPointerCapture on the container, which retargets pointerup so the
   * browser fires `click` on the container rather than the button. Binding to
   * the canvas (a sibling of the buttons, not their ancestor) keeps drag/zoom
   * working on the canvas while control buttons keep receiving real clicks.
   * Preserves the current pivot, zoom limits and damping.
   */
  rebindToCanvas(canvas: HTMLElement): void {
    const prev = this.controls;
    const next = new OrbitControls(this.camera, canvas);
    next.enableDamping = prev.enableDamping;
    next.dampingFactor = prev.dampingFactor;
    next.minDistance = prev.minDistance;
    next.maxDistance = prev.maxDistance;
    next.target.copy(prev.target);
    this.controls = next;
    next.update();
    prev.dispose();
  }

  /** Move the orbit pivot to an absolute world position (no follow). */
  lookAt(worldPos: THREE.Vector3): void {
    this.controls.target.copy(worldPos);
    this.controls.update();
  }

  /** Pin the orbit pivot onto a moving object; clear any previous follow. */
  follow(object: {
    getWorldPosition: (out: THREE.Vector3) => THREE.Vector3;
  }): void {
    this.followTarget = object;
  }

  /** Drop follow mode so the pivot stays wherever it is. */
  clearFollow(): void {
    this.followTarget = null;
  }

  get isFollowing(): boolean {
    return this.followTarget !== null;
  }

  /** Restore the resting orbit view and drop follow mode. */
  home(): void {
    this.clearFollow();
    this.camera.position.copy(this.homePos);
    this.lookAt(new THREE.Vector3(0, 0, 0));
  }

  /** Call every frame (from SolarSystem.onFrame) before render. */
  update(): void {
    if (this.followTarget) {
      this.followTarget.getWorldPosition(this.tmp);
      this.controls.target.copy(this.tmp);
    }
    this.controls.update();
  }
}
