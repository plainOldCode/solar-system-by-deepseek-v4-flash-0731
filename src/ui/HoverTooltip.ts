/**
 * HoverTooltip — a compact, transient label that identifies a body the pointer
 * is over, without ever stealing pointer events.
 *
 * Per the spec (§10), on pointer hover we show Korean name, English name, and
 * object type in a small overlay that follows the cursor (clamped to the
 * viewport). It is a purely informational overlay: `pointer-events: none` and
 * the `aria-hidden` tooltip role mean it never intercepts clicks or raycasts,
 * so deterministic click selection is completely unaffected. On touch devices
 * there is no hover, so the tooltip simply never appears and never interferes
 * with touch selection.
 */
import type { CelestialBodyData } from "../data/types";
import { TYPE_LABEL_KO } from "./format";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing required element #${id}`);
  return node as T;
}

/** Cursor offset (px) between the pointer and the top-left of the tooltip. */
const OFFSET_X = 14;
const OFFSET_Y = 14;

export class HoverTooltip {
  private readonly root: HTMLElement;
  private readonly nameEl: HTMLElement;
  private readonly enEl: HTMLElement;
  private readonly typeEl: HTMLElement;

  constructor() {
    this.root = el<HTMLElement>("hover-tooltip");
    this.nameEl = el<HTMLElement>("hover-tooltip-name");
    this.enEl = el<HTMLElement>("hover-tooltip-en");
    this.typeEl = el<HTMLElement>("hover-tooltip-type");
    // The overlay is decorative confirmation of what the user is already
    // pointing at — hidden from assistive tech so it isn't read redundantly
    // alongside the (announced) selection model.
    this.root.setAttribute("aria-hidden", "true");
    this.root.setAttribute("role", "tooltip");
  }

  /** Fill + show the tooltip near the cursor (safe to call on every move). */
  show(data: CelestialBodyData, clientX: number, clientY: number): void {
    this.nameEl.textContent = data.nameKo;
    this.enEl.textContent = data.nameEn;
    this.typeEl.textContent = TYPE_LABEL_KO[data.type] ?? data.type;
    this.root.hidden = false;
    this.position(clientX, clientY);
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Re-position an already-visible tooltip as the cursor moves. */
  reposition(clientX: number, clientY: number): void {
    if (this.root.hidden) return;
    this.position(clientX, clientY);
  }

  /** Offset from the cursor and clamp to the viewport so it never runs off-screen. */
  private position(clientX: number, clientY: number): void {
    const w = this.root.offsetWidth || 0;
    const h = this.root.offsetHeight || 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = clientX + OFFSET_X;
    let y = clientY + OFFSET_Y;
    if (x + w > vw) x = clientX - OFFSET_X - w;
    if (y + h > vh) y = clientY - OFFSET_Y - h;
    this.root.style.transform = `translate(${Math.max(0, x)}px, ${Math.max(0, y)}px)`;
  }
}
