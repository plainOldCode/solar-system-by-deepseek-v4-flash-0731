/**
 * ControlPanel — wires the static, accessible control bar (see index.html) to
 * the app. All controls are real interactive elements (buttons / a select) so
 * they are focusable and keyboard-operable out of the box; labels live in the
 * DOM rather than as bare icons.
 *
 * The panel is a thin presenter: it owns no simulation state, it just renders
 * current state and forwards user intent through the handler object.
 */
import type { CelestialBodyData } from "../data/types";

export interface ControlPanelHandlers {
  onTogglePlay(): void;
  /** direction is +1 (faster) or -1 (slower), stepped through the speed ladder. */
  onSpeedStep(direction: 1 | -1): void;
  onSpeedReset(): void;
  onToggleLabels(): void;
  onSelectBody(id: string): void;
  onPrevBody(): void;
  onNextBody(): void;
  onHome(): void;
}

export interface BodyOption {
  id: string;
  nameKo: string;
  nameEn: string;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing required element #${id}`);
  return node as T;
}

export class ControlPanel {
  private readonly handlers: ControlPanelHandlers;
  private readonly playBtn: HTMLButtonElement;
  private readonly speedDown: HTMLButtonElement;
  private readonly speedUp: HTMLButtonElement;
  private readonly speedValue: HTMLElement;
  private readonly speedReset: HTMLButtonElement;
  private readonly labelsBtn: HTMLButtonElement;
  private readonly prevBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;
  private readonly homeBtn: HTMLButtonElement;
  private readonly bodySelect: HTMLSelectElement;

  constructor(handlers: ControlPanelHandlers) {
    this.handlers = handlers;
    this.playBtn = el<HTMLButtonElement>("ctrl-play");
    this.speedDown = el<HTMLButtonElement>("speed-down");
    this.speedUp = el<HTMLButtonElement>("speed-up");
    this.speedValue = el<HTMLElement>("speed-value");
    this.speedReset = el<HTMLButtonElement>("speed-reset");
    this.labelsBtn = el<HTMLButtonElement>("ctrl-labels");
    this.prevBtn = el<HTMLButtonElement>("focus-prev");
    this.nextBtn = el<HTMLButtonElement>("focus-next");
    this.homeBtn = el<HTMLButtonElement>("ctrl-home");
    this.bodySelect = el<HTMLSelectElement>("body-select");

    this.playBtn.addEventListener("click", () => this.handlers.onTogglePlay());
    this.speedDown.addEventListener("click", () => this.handlers.onSpeedStep(-1));
    this.speedUp.addEventListener("click", () => this.handlers.onSpeedStep(1));
    this.speedReset.addEventListener("click", () => this.handlers.onSpeedReset());
    this.labelsBtn.addEventListener("click", () => this.handlers.onToggleLabels());
    this.prevBtn.addEventListener("click", () => this.handlers.onPrevBody());
    this.nextBtn.addEventListener("click", () => this.handlers.onNextBody());
    this.homeBtn.addEventListener("click", () => this.handlers.onHome());
    this.bodySelect.addEventListener("change", () => {
      if (this.bodySelect.value) this.handlers.onSelectBody(this.bodySelect.value);
    });
  }

  /** Populate the quick-select dropdown once at startup. */
  populateBodies(options: readonly BodyOption[]): void {
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = `${o.nameKo} (${o.nameEn})`;
      this.bodySelect.appendChild(opt);
    }
  }

  selectBodyOption(id: string): void {
    if (this.bodySelect.value !== id) this.bodySelect.value = id;
  }

  setPlaying(playing: boolean): void {
    this.playBtn.textContent = playing ? "⏸ 일시정지" : "▶ 재생";
    this.playBtn.setAttribute("aria-pressed", String(playing));
    this.playBtn.title = playing ? "시뮬레이션 일시정지" : "시뮬레이션 재생";
  }

  setSpeedLabel(daysPerSecond: number): void {
    // e.g. "1일/초", "3650일/초" — simulated days advanced per real second,
    // matching the rung's meaning in the speed ladder.
    this.speedValue.textContent = `${daysPerSecond}일/초`;
  }

  setSpeedLimits(atMin: boolean, atMax: boolean): void {
    this.speedDown.disabled = atMin;
    this.speedUp.disabled = atMax;
  }

  setLabelsVisible(visible: boolean): void {
    this.labelsBtn.textContent = visible ? "✕ 레이블 숨기기" : "레이블 표시";
    this.labelsBtn.setAttribute("aria-pressed", String(visible));
  }

  setSelected(data: CelestialBodyData | null): void {
    if (data) {
      this.selectBodyOption(data.id);
    }
  }
}
