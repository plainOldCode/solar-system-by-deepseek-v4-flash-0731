/**
 * InfoPanel — shows details of the currently selected celestial body.
 *
 * The content is produced by the pure `formatBodyInfo` helper (unit-tested in
 * isolation) and injected here as accessible DOM: headings, a definition list,
 * and the body's Korean description. A live region is kept separate so screen
 * readers announce selection changes without re-reading the whole panel.
 */
import type { CelestialBodyData } from "../data/types";
import { bodyAlt, formatBodyInfo } from "./format";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing required element #${id}`);
  return node as T;
}

export class InfoPanel {
  private readonly panel: HTMLElement;
  private readonly titleKo: HTMLElement;
  private readonly titleEn: HTMLElement;
  private readonly typeBadge: HTMLElement;
  private readonly swatch: HTMLElement;
  private readonly list: HTMLDListElement;
  private readonly description: HTMLElement;
  private readonly empty: HTMLElement;

  constructor() {
    this.panel = el<HTMLElement>("info-panel");
    this.titleKo = el<HTMLElement>("info-title-ko");
    this.titleEn = el<HTMLElement>("info-title-en");
    this.typeBadge = el<HTMLElement>("info-type");
    this.swatch = el<HTMLElement>("info-swatch");
    this.list = el<HTMLDListElement>("info-list");
    this.description = el<HTMLElement>("info-desc");
    this.empty = el<HTMLElement>("info-empty");
  }

  /** Swatch uses the body colour as a small inline SVG data URI (no fetch). */
  private static swatchUrl(color: string): string {
    return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Ccircle cx='8' cy='8' r='7' fill='${encodeURIComponent(color)}'/%3E%3C/svg%3E")`;
  }

  setBody(data: CelestialBodyData | null): void {
    if (!data) {
      this.panel.classList.add("empty");
      this.titleKo.textContent = "";
      this.titleEn.textContent = "";
      this.typeBadge.textContent = "";
      this.swatch.style.backgroundImage = "";
      this.list.innerHTML = "";
      this.description.textContent = "";
      this.empty.hidden = false;
      this.panel.setAttribute("aria-label", "선택된 천체 정보 없음");
      return;
    }

    const info = formatBodyInfo(data);
    this.panel.classList.remove("empty");
    this.empty.hidden = true;
    this.titleKo.textContent = info.titleKo;
    this.titleEn.textContent = info.titleEn;
    this.typeBadge.textContent = info.typeKo;
    this.swatch.style.backgroundImage = InfoPanel.swatchUrl(info.color);
    this.panel.setAttribute("aria-label", bodyAlt(data));

    this.list.innerHTML = "";
    const rows: Array<[string, string, string]> = [
      ["궤도 거리", info.distance, "semi-major axis from Sun/parent"],
      ["반지름", info.radius, "equatorial radius"],
      ["공전 주기", info.period, "sidereal orbital period"],
      ["자전 주기", info.rotation, "sidereal rotation period"],
      ["자전축 기울기", info.axialTilt, "axial tilt"],
    ];
    for (const [label, value, note] of rows) {
      const term = document.createElement("dt");
      term.textContent = label;
      term.title = note;
      const def = document.createElement("dd");
      def.textContent = value;
      this.list.appendChild(term);
      this.list.appendChild(def);
    }
    this.description.textContent = info.description;
  }

  get isOpen(): boolean {
    return !this.panel.classList.contains("empty");
  }
}
