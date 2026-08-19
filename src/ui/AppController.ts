/**
 * AppController — composes the scene, camera rig, controls, info panel, labels
 * and selection ring into the interactive application presented by main.ts.
 *
 * Responsibilities (all UI/presentation concerns — it does not reimplement
 * the scene or simulation logic):
 *   - pointer selection via raycasting + hover cursor
 *   - keyboard navigation (arrows / Escape / Space) with focus management
 *   - follow-cam targeting and explicit focus ("go to") zoom
 *   - selection ring reparented onto the selected body so it tracks it
 *   - simulation controls (play/pause, speed ladder, reset)
 *   - responsive resize and accessible live-region announcements
 *
 * Headless-testable pieces (selection ordering, focus distance, info
 * formatting) live in selectionModel.ts / format.ts.
 */
import * as THREE from "three";
import { SolarSystem } from "../core/SolarSystem";
import { CameraRig } from "../core/CameraRig";
import { ScaleManager } from "../core/ScaleManager";
import type { DistanceScaleMode, RadiusScaleMode } from "../core/ScaleManager";
import { Labels } from "./Labels";
import { ControlPanel, type ControlPanelHandlers } from "./ControlPanel";
import { InfoPanel } from "./InfoPanel";
import { HudVisibility } from "./hudVisibility";
import { SOLAR_SYSTEM } from "../data/solarSystemData";
import type { CelestialBody } from "../core/CelestialBody";
import {
  focusDistanceFor,
  nextSelection,
  prevSelection,
  resolveBodyPick,
} from "./selectionModel";
import {
  bodyAlt,
  formatSimDays,
  DISTANCE_MODE_LABEL_KO,
  SIZE_MODE_LABEL_KO,
} from "./format";

// Speed ladder in simulated DAYS advanced per real second. The engine's clock
// accumulates simulated *seconds*, so each rung is multiplied by 86 400 when
// pushed into the clock. The default rate is 0.1 days/sec (one tenth of the
// previous "1 second = 1 day" spec baseline): applied at the shared, whole-ladder
// simulation-time level (each rung is exactly one tenth of its old value, and
// the default is the bottom rung) so real relative orbital-period ratios remain
// unchanged and pause/play, stepping, reset, displayed values, and date
// progression all stay coherent with the new default.
const SECONDS_PER_DAY = 86_400;
export const SPEED_LADDER_DAYS = [0.1, 0.2, 0.5, 1, 3, 10, 36.5, 100, 365, 1000];
export const DEFAULT_SPEED_DAYS = 0.1; // one tenth of the original 1 day/sec default
const RING_COLOR = 0x7fb2ff;

export class AppController {
  private readonly system: SolarSystem;
  private readonly rig: CameraRig;
  private readonly labels: Labels;
  private readonly control: ControlPanel;
  private readonly info: InfoPanel;
  private readonly status: HTMLElement;
  private readonly clockEl: HTMLElement;
  private readonly container: HTMLElement;
  private readonly controlBar: HTMLElement;
  private readonly barObserver: ResizeObserver | null = null;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  private readonly scale: ScaleManager;
  private hoveredId: string | null = null;
  private selectedId: string | null = null;
  private speed = DEFAULT_SPEED_DAYS; // stored in days-per-real-second
  private labelsDesired = true; // user's independent in-scene label preference
  private orbitsVisible = true;
  private moonsVisible = true;
  private starsVisible = true;
  private ring: THREE.Group | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.rig = new CameraRig(container, width / height, {
      homePosition: new THREE.Vector3(0, 28, 42),
    });
    this.scale = new ScaleManager();
    this.system = new SolarSystem(container, {
      camera: this.rig.camera,
      scale: this.scale,
      onFrame: (timeDays) => {
        this.rig.update();
        this.renderClock(timeDays);
      },
    });
    // OrbitControls must listen on the canvas, not the wrapper container, so
    // real pointer clicks on the control-bar buttons aren't swallowed by
    // OrbitControls' pointer capture (which would fire `click` on #app instead
    // of the button). The canvas only exists after SolarSystem is built.
    this.rig.rebindToCanvas(this.system.renderer.domElement);
    this.labels = new Labels(this.system.views.bodies);
    this.info = new InfoPanel();
    this.control = new ControlPanel(this.handlers());
    new HudVisibility(container, {
      onVisibilityChange: (visible) => this.applyHudLabels(visible),
    });
    this.status = document.getElementById("status") as HTMLElement;
    this.clockEl = document.getElementById("hud-date") as HTMLElement;
    const canvas = this.system.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "태양계 3D 장면. 드래그로 회전, 휠로 확대/축소, ▲▼ 키로 천체 이동.",
    );

    this.control.populateBodies(
      SOLAR_SYSTEM.map((b) => ({ id: b.id, nameKo: b.nameKo, nameEn: b.nameEn })),
    );
    this.applySpeedUI();
    this.control.setPlaying(true);
    this.control.setLabelsVisible(true);
    this.control.setDistanceMode(this.system.distanceMode);
    this.control.setSizeMode(this.system.sizeMode);
    this.control.setOrbitsVisible(this.orbitsVisible);
    this.control.setMoonsVisible(this.moonsVisible);
    this.control.setStarsVisible(this.starsVisible);
    this.bindEvents();
    this.clearSelection(false);

    // Keep the mobile info panel clear of the (wrap-capable) control bar.
    this.controlBar = document.querySelector(
      ".control-bar",
    ) as HTMLElement;
    this.syncInfoPanelGap();
    if (typeof ResizeObserver !== "undefined") {
      this.barObserver = new ResizeObserver(() => this.syncInfoPanelGap());
      this.barObserver.observe(this.controlBar);
    }

    // Kick off the rAF loop. Without this, renderer.render() is never called
    // and the canvas stays black even though the scene graph is fully built.
    this.system.start();

    window.addEventListener("resize", this.onResize);
  }

  /* ── controllers → handlers ───────────────────────────────────── */

  private handlers(): ControlPanelHandlers {
    return {
      onTogglePlay: () => this.togglePlay(),
      onSpeedStep: (d) => this.stepSpeed(d),
      onSpeedReset: () => this.resetSimulation(),
      onDistanceMode: (mode) => this.applyDistanceMode(mode),
      onSizeMode: (mode) => this.applySizeMode(mode),
      onToggleOrbits: () => this.toggleOrbits(),
      onToggleMoons: () => this.toggleMoons(),
      onToggleStars: () => this.toggleStars(),
      onToggleLabels: () => {
        this.labelsDesired = !this.labels.enabledState;
        this.labels.setEnabled(this.labelsDesired);
        this.control.setLabelsVisible(this.labelsDesired);
        this.announce(this.labelsDesired ? "이름표 표시" : "이름표 숨김");
      },
      onSelectBody: (id) => this.select(id, true),
      onPrevBody: () => this.select(prevSelection(this.selectedId), true),
      onNextBody: () => this.select(nextSelection(this.selectedId), true),
      onHome: () => this.clearSelection(true),
    };
  }

  /* ── selection & focus ─────────────────────────────────────────── */

  /** Select a body; `zoom` pulls the camera to a comfortable focus distance. */
  private select(id: string, zoom: boolean): void {
    const body = this.system.views.byId.get(id);
    if (!body) return;

    this.selectedId = id;
    this.hoveredId = id;
    this.info.setBody(body.data);
    this.control.setSelected(body.data);
    this.attachRing(body);
    this.rig.follow(body.group);

    if (zoom) {
      const r = bodyMeshRadius(body);
      const dist = focusDistanceFor(r);
      this.rig.controls.maxDistance = Math.max(
        dist * 8,
        this.rig.controls.maxDistance,
      );
      this.rig.controls.minDistance = Math.min(
        this.rig.controls.maxDistance,
        dist * 0.5,
      );
      const dir = this.rig.camera.position
        .clone()
        .sub(this.rig.controls.target)
        .normalize();
      this.rig.camera.position
        .copy(this.rig.controls.target)
        .addScaledVector(dir, dist);
      this.rig.controls.update();
    }
    // Keep the focus-distance-mode centre aligned to the newly selected system.
    this.system.setFocusKm(this.focusReferenceKm());
    this.announce(`${body.data.nameKo} 선택됨. ${bodyAlt(body.data)}.`);
  }

  private clearSelection(home: boolean): void {
    this.selectedId = null;
    this.hoveredId = null;
    this.info.setBody(null);
    this.control.setSelected(null);
    if (this.ring) {
      this.ring.parent?.remove(this.ring);
      disposeGroup(this.ring);
      this.ring = null;
    }
    this.rig.clearFollow();
    // Deselecting also drops any focus-distance-mode centre (falls back to log).
    this.system.setFocusKm(null);
    if (home) {
      this.rig.home();
      this.announce("선택을 해제하고 태양 중심 화면으로 돌아갑니다.");
    }
  }

  /** Ring as a child of the body's group tracks it automatically. */
  private attachRing(body: CelestialBody): void {
    if (this.ring) {
      this.ring.parent?.remove(this.ring);
      disposeGroup(this.ring);
    }
    const r = bodyMeshRadius(body);
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.22, 24, 16),
      new THREE.MeshBasicMaterial({
        color: RING_COLOR,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.42, Math.max(r * 0.08, 0.03), 8, 48),
      new THREE.MeshBasicMaterial({
        color: RING_COLOR,
        transparent: true,
        opacity: 0.95,
      }),
    );
    torus.rotation.x = Math.PI / 2;
    const group = new THREE.Group();
    group.name = "selection-ring";
    group.add(shell, torus);
    this.ring = group;
    body.group.add(group);
  }

  /* ── pointer interaction ───────────────────────────────────────── */

  private bindEvents(): void {
    const canvas = this.system.renderer.domElement;
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("click", this.onClick);
    window.addEventListener("keydown", this.onKeyDown);
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    const bodyId = this.pickBody(e as { clientX: number; clientY: number });
    if (bodyId !== this.hoveredId) {
      this.hoveredId = bodyId;
      this.system.renderer.domElement.style.cursor = bodyId ? "pointer" : "grab";
    }
  };

  private readonly onPointerDown = (): void => {
    this.system.renderer.domElement.style.cursor = "grabbing";
  };

  private readonly onClick = (e: MouseEvent): void => {
    this.system.renderer.domElement.style.cursor = "grab";
    const bodyId = this.pickBody(e as { clientX: number; clientY: number });
    if (bodyId) this.select(bodyId, false);
    else this.clearSelection(false); // click on empty space just deselects
  };

  private pickBody(e: { clientX: number; clientY: number }): string | null {
    const rect = this.system.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.rig.camera);
    // Selection identity must be deterministic: clicking a visible (opaque)
    // body selects THAT exact body. Resolve body-mesh hits before orbit-line
    // hits so a guide line can never shadow a sphere (see resolveBodyPick).
    return resolveBodyPick(
      this.raycaster.intersectObjects(
        this.system.views.bodies.map((b) => b.mesh),
        false,
      ),
      this.raycaster.intersectObjects(this.system.views.lines, false),
    );
  }

  /* ── keyboard interaction ──────────────────────────────────────── */

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && /^(BUTTON|SELECT|INPUT|TEXTAREA|OPTION)$/.test(t.tagName)) return;

    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        this.select(nextSelection(this.selectedId), true);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        this.select(prevSelection(this.selectedId), true);
        break;
      case " ":
        e.preventDefault();
        this.togglePlay();
        break;
      case "Escape":
        e.preventDefault();
        this.clearSelection(true);
        break;
      default:
        break;
    }
  };

  /* ── simulation controls ───────────────────────────────────────── */

  private togglePlay(): void {
    const wasPaused = this.system.clock.paused;
    this.system.clock.setPaused(!wasPaused);
    this.control.setPlaying(this.system.clock.paused === false);
    this.announce(this.system.clock.paused ? "일시정지" : "재생");
  }

  private stepSpeed(direction: 1 | -1): void {
    const idx = SPEED_LADDER_DAYS.indexOf(this.speed);
    const next = Math.min(
      SPEED_LADDER_DAYS.length - 1,
      Math.max(0, idx + direction),
    );
    this.speed = SPEED_LADDER_DAYS[next];
    this.system.clock.setSpeed(this.speed * SECONDS_PER_DAY);
    this.applySpeedUI();
  }

  private resetSimulation(): void {
    this.speed = DEFAULT_SPEED_DAYS;
    this.system.clock.setSpeed(this.speed * SECONDS_PER_DAY);
    this.system.clock.reset(0);
    if (this.system.clock.paused) this.system.clock.setPaused(false);
    this.control.setPlaying(true);
    this.applySpeedUI();
    this.announce("시뮬레이션 시간과 속도를 초기화했습니다.");
  }

  private applySpeedUI(): void {
    this.control.setSpeedLabel(this.speed);
    const idx = SPEED_LADDER_DAYS.indexOf(this.speed);
    this.control.setSpeedLimits(idx <= 0, idx >= SPEED_LADDER_DAYS.length - 1);
    // Keep the engine clock multiplier in sync with the displayed days/sec:
    // the clock advances simulated seconds, one civil day = 86 400 of them.
    this.system.clock.setSpeed(this.speed * SECONDS_PER_DAY);
  }

  /**
   * Reflect the running simulation clock in the HUD date read-out. */
  private renderClock(timeDays: number): void {
    this.clockEl.textContent = `시뮬레이션 ${formatSimDays(timeDays)}`;
  }

  /* ── scale-mode & visibility controls ──────────────────────────── */

  /** Switch the global distance mapping (log / linear / focus). */
  private applyDistanceMode(mode: DistanceScaleMode): void {
    // Make sure the focus reference tracks the current selection before
    // activating focus mode, and that focusing a new selection recentres it.
    this.system.setFocusKm(this.focusReferenceKm());
    this.system.setDistanceMode(mode); // (re)builds rings + positions
    this.control.setDistanceMode(mode);
    this.announce(`거리 스케일: ${DISTANCE_MODE_LABEL_KO[mode]}`);
  }

  /** Switch the body-size mapping (enhanced / relative / uniform). */
  private applySizeMode(mode: RadiusScaleMode): void {
    this.system.setSizeMode(mode);
    this.labels.refreshPositions(); // sprites ride above the resized spheres
    if (this.selectedId) {
      const body = this.system.views.byId.get(this.selectedId);
      if (body) this.attachRing(body); // selection ring tracks the new sphere size
    }
    this.control.setSizeMode(mode);
    this.announce(`천체 크기 모드: ${SIZE_MODE_LABEL_KO[mode]}`);
  }

  private toggleOrbits(): void {
    this.orbitsVisible = !this.orbitsVisible;
    this.system.setOrbitsVisible(this.orbitsVisible);
    this.control.setOrbitsVisible(this.orbitsVisible);
    this.announce(this.orbitsVisible ? "궤도 표시" : "궤도 숨김");
  }

  private toggleMoons(): void {
    this.moonsVisible = !this.moonsVisible;
    this.system.setMoonsVisible(this.moonsVisible);
    this.labels.setMoonsVisible(this.moonsVisible);
    this.control.setMoonsVisible(this.moonsVisible);
    this.announce(this.moonsVisible ? "위성 표시" : "위성 숨김");
  }

  private toggleStars(): void {
    this.starsVisible = !this.starsVisible;
    this.system.setStarsVisible(this.starsVisible);
    this.control.setStarsVisible(this.starsVisible);
    this.announce(this.starsVisible ? "별 필드 표시" : "별 필드 숨김");
  }

  /**
   * Focus reference for the focus distance mode: the heliocentric km of the
   * selected planetary system. A selected moon recentres on its parent planet;
   * the Sun / no selection disables the focused centre (→ log fallback).
   */
  private focusReferenceKm(): number | null {
    if (!this.selectedId) return null;
    const body = this.system.views.byId.get(this.selectedId);
    if (!body) return null;
    if (body.data.type === "moon" && body.data.parentId) {
      const parent = this.system.views.byId.get(body.data.parentId);
      return parent && parent.semiMajorAxisKm > 0 ? parent.semiMajorAxisKm : null;
    }
    return body.semiMajorAxisKm > 0 ? body.semiMajorAxisKm : null;
  }

  /**
   * Fold the in-scene name labels in/out when the whole HUD is hidden/shown.
   * Panels-hidden forcibly hides scene labels (clean core view); restoring the
   * HUD brings them back to the user's independent label preference.
   */
  private applyHudLabels(visible: boolean): void {
    if (visible) {
      this.labels.setEnabled(this.labelsDesired);
      this.control.setLabelsVisible(this.labelsDesired);
    } else {
      this.labelsDesired = this.labels.enabledState;
      this.labels.setEnabled(false);
      this.control.setLabelsVisible(false);
    }
  }

  private announce(msg: string): void {
    this.status.textContent = msg;
  }

  /* ── resize / teardown ─────────────────────────────────────────── */

  /**
   * Pin the mobile info panel above the control bar using the live bar
   * geometry. The control bar wraps to 2+ rows on narrow screens, so a fixed
   * CSS offset cannot reliably clear it; the actual measured bar top does.
   * `getBoundingClientRect` already reflects the bar's own bottom offset and
   * safe-area inset (and its real wrapped height), so this stays correct
   * through re-wraps, browser-chrome shrink and orientation changes.
   */
  private readonly syncInfoPanelGap = (): void => {
    const bar = this.controlBar;
    if (!bar) return;
    const containerRect = this.container.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const bottom = Math.max(containerRect.bottom - barRect.top + 12, 84);
    document.documentElement.style.setProperty(
      "--info-panel-bottom",
      `${bottom}px`,
    );
  };

  private readonly onResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.rig.resize(w / h);
    this.system.resize(w, h);
    this.syncInfoPanelGap();
  };

  dispose(): void {
    window.removeEventListener("resize", this.onResize);
    this.barObserver?.disconnect();
    this.labels.dispose();
    if (this.ring) {
      this.ring.parent?.remove(this.ring);
      disposeGroup(this.ring);
    }
    this.system.dispose();
  }
}

function bodyMeshRadius(body: CelestialBody): number {
  const params = (body.mesh.geometry as THREE.SphereGeometry).parameters;
  return typeof params.radius === "number" && Number.isFinite(params.radius)
    ? params.radius
    : 1;
}

/** Dispose a selection-ring group's geometries + materials. */
function disposeGroup(group: THREE.Group): void {
  for (const child of group.children) {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  }
}
