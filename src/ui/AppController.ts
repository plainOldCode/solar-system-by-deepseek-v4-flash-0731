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
import { Labels } from "./Labels";
import { ControlPanel, type ControlPanelHandlers } from "./ControlPanel";
import { InfoPanel } from "./InfoPanel";
import { SOLAR_SYSTEM } from "../data/solarSystemData";
import type { CelestialBody } from "../core/CelestialBody";
import {
  bodyIdFromIntersects,
  focusDistanceFor,
  nextSelection,
  prevSelection,
} from "./selectionModel";
import { bodyAlt } from "./format";

const SPEED_LADDER = [0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];
const RING_COLOR = 0x7fb2ff;

export class AppController {
  private readonly system: SolarSystem;
  private readonly rig: CameraRig;
  private readonly labels: Labels;
  private readonly control: ControlPanel;
  private readonly info: InfoPanel;
  private readonly status: HTMLElement;
  private readonly container: HTMLElement;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  private hoveredId: string | null = null;
  private selectedId: string | null = null;
  private speed = 1;
  private ring: THREE.Group | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.rig = new CameraRig(container, width / height, {
      homePosition: new THREE.Vector3(0, 28, 42),
    });
    this.system = new SolarSystem(container, {
      camera: this.rig.camera,
      onFrame: () => this.rig.update(),
    });
    this.labels = new Labels(this.system.views.bodies);
    this.info = new InfoPanel();
    this.control = new ControlPanel(this.handlers());
    this.status = document.getElementById("status") as HTMLElement;

    // Make the canvas a real, labelled focus target for keyboard users.
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
    this.bindEvents();
    this.clearSelection(false);

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
      onToggleLabels: () => {
        this.labels.setEnabled(!this.labels.enabledState);
        this.control.setLabelsVisible(this.labels.enabledState);
        this.announce(this.labels.enabledState ? "이름표 표시" : "이름표 숨김");
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
    const targets: THREE.Object3D[] = [
      ...this.system.views.bodies.map((b) => b.mesh),
      ...this.system.views.lines,
    ];
    const hits = this.raycaster.intersectObjects(targets, false);
    return bodyIdFromIntersects(hits);
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
    const idx = SPEED_LADDER.indexOf(this.speed);
    const next = Math.min(
      SPEED_LADDER.length - 1,
      Math.max(0, idx + direction),
    );
    this.speed = SPEED_LADDER[next];
    this.system.clock.setSpeed(this.speed);
    this.applySpeedUI();
  }

  private resetSimulation(): void {
    this.speed = 1;
    this.system.clock.setSpeed(1);
    this.system.clock.reset(0);
    if (this.system.clock.paused) this.system.clock.setPaused(false);
    this.control.setPlaying(true);
    this.applySpeedUI();
    this.announce("시뮬레이션 시간과 속도를 초기화했습니다.");
  }

  private applySpeedUI(): void {
    this.control.setSpeedLabel(this.speed);
    const idx = SPEED_LADDER.indexOf(this.speed);
    this.control.setSpeedLimits(idx <= 0, idx >= SPEED_LADDER.length - 1);
  }

  private announce(msg: string): void {
    this.status.textContent = msg;
  }

  /* ── resize / teardown ─────────────────────────────────────────── */

  private readonly onResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.rig.resize(w / h);
    this.system.resize();
  };

  dispose(): void {
    window.removeEventListener("resize", this.onResize);
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
