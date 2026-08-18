/**
 * hudVisibility — global, accessible "Hide Panels / Show Panels" control.
 *
 * Toggles the whole 2D HUD (header, info panel, control bar, keyboard hint)
 * as a group, plus — via an optional callback — the in-scene name labels.
 * A dedicated, persistent *Show Panels* affordance lives outside the hidden
 * group so it can never be swept away with the rest of the HUD.
 *
 * Accessibility:
 *  - Both controls are real <button>s, so they are natively focusable and
 *    operable with Enter/Space from the keyboard.
 *  - The in-bar toggle carries `aria-pressed` to expose its boolean state to
 *    assistive tech.
 *  - The persistent affordance keeps an explicit accessible name.
 *  - Focus is moved onto the affordance when the HUD hides, and back onto
 *    the in-bar toggle when it is shown, so keyboard users are never left on
 *    a hidden element and can always see how to restore the HUD.
 *
 * The pure helpers (`togglePanelVisibility`, `panelsPressed`, …) are kept
 * separate from the DOM class so the semantics can be unit-tested headlessly
 * in the same way as selectionModel / format.
 */
export type PanelVisibility = "visible" | "hidden";

/** Class toggled on the app root while the HUD is hidden (drives CSS). */
export const HUD_HIDDEN_CLASS = "hud-hidden";

/** Selector for the persistent affordance that must NOT be part of the group. */
export const SHOW_AFFORDANCE_SELECTOR = "#show-panels";

/** DOM HUD regions collapsed together when panels are hidden (not the affordance). */
export const HIDDEN_TARGETS = [
  ".hud-header",
  ".info-panel",
  ".control-bar",
  ".kb-hint",
] as const;

export function togglePanelVisibility(
  current: PanelVisibility,
): PanelVisibility {
  return current === "visible" ? "hidden" : "visible";
}

/** `aria-pressed` value reflecting whether the HUD group is currently shown. */
export function panelsPressed(visible: boolean): "true" | "false" {
  return visible ? "true" : "false";
}

/** Label for the in-bar toggle: the action it will perform right now. */
export function inBarToggleLabel(visible: boolean): string {
  return visible ? "패널 숨기기" : "패널 표시";
}

/** Accessible name for the always-present Show Panels affordance. */
export function affordanceLabel(visible: boolean): string {
  return visible ? "패널 숨기기" : "패널 표시";
}

export interface HudVisibilityOptions {
  /** Called whenever the visibility toggles, with the new flag (e.g. en/disable in-scene labels). */
  onVisibilityChange?: (visible: boolean) => void;
}

/** DOM presenter: owns the two buttons + the root class. Headless-pure parts are exported above. */
export class HudVisibility {
  private visible: boolean;
  private readonly root: HTMLElement;
  private readonly inBarToggle: HTMLButtonElement;
  private readonly affordance: HTMLButtonElement;
  private readonly onVisibilityChange?: (visible: boolean) => void;

  constructor(root: HTMLElement, options: HudVisibilityOptions = {}) {
    this.root = root;
    this.visible = true;
    this.onVisibilityChange = options.onVisibilityChange;

    const inBar = root.querySelector<HTMLButtonElement>("#ctrl-panels");
    if (!inBar) throw new Error("Missing required element #ctrl-panels");
    this.inBarToggle = inBar;

    const affordance = root.querySelector<HTMLButtonElement>(
      SHOW_AFFORDANCE_SELECTOR,
    );
    if (!affordance)
      throw new Error(`Missing required element ${SHOW_AFFORDANCE_SELECTOR}`);
    this.affordance = affordance;

    this.inBarToggle.addEventListener("click", () => this.setVisible(!this.visible));
    this.affordance.addEventListener("click", () => this.setVisible(true));

    this.apply();
  }

  get panelsVisible(): boolean {
    return this.visible;
  }

  /** Programmatic toggle (from voice/keyboard shortcuts if added later). */
  toggle(): void {
    this.setVisible(!this.visible);
  }

  private setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.apply();
  }

  private apply(): void {
    // 1. Drive the HUD group's visibility with one root class.
    this.root.classList.toggle(HUD_HIDDEN_CLASS, !this.visible);

    // 2. In-bar toggle reflects/presents the current state.
    this.inBarToggle.textContent = inBarToggleLabel(this.visible);
    this.inBarToggle.setAttribute("aria-pressed", panelsPressed(this.visible));
    this.inBarToggle.title = inBarToggleLabel(this.visible);

    // 3. Persistent affordance — present only while hidden (`hidden` removes it
    //    from layout, focus and the a11y tree at the same time).
    this.affordance.hidden = this.visible;
    this.affordance.setAttribute(
      "aria-label",
      affordanceLabel(this.visible),
    );
    this.affordance.title = affordanceLabel(this.visible);

    // 4. Keep focus on a visible control so keyboard users aren't stranded.
    if (!this.visible) this.affordance.focus();
    else if (document.activeElement === this.affordance) this.inBarToggle.focus();

    // 5. Let the controller fold in-scene labels in/out too.
    this.onVisibilityChange?.(this.visible);
  }
}
