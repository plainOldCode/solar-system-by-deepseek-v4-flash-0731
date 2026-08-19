/**
 * Labels — in-scene name tags rendered as billboarded sprites above each body.
 *
 * A label is a small rounded-box canvas painted with the body's Korean primary
 * name and its English secondary name, wrapped in a `CanvasTexture` and drawn
 * as a `THREE.Sprite` child of the body's group. Because it is a child of the
 * group it travels with the planet automatically; `depthTest` keeps it hidden
 * behind nearer bodies. No external assets are fetched — every label is
 * generated at runtime, so there is no network-load failure path to handle.
 *
 * Label legibility follows prompt §11 (Korean primary / English secondary)
 * and the "density reduction" guidance:
 *   - Moon labels only *reveal* when their own planetary system is focused
 *     (the moon itself is selected, or its parent planet/dwarf is selected),
 *     gated by the global moon-visibility toggle. So the 21 moon tags never
 *     crowd the broad Solar-system view.
 *   - As the camera pulls back to a broad view, every label fades toward a
 *     dim opacity floor (`setCrowdFade`) so the scene stays legible rather
 *     than overcrowded; zooming back in restores full opacity.
 */
import * as THREE from "three";
import type { CelestialBodyData } from "../data/types";
import type { CelestialBody } from "../core/CelestialBody";

const CANVAS_W = 512;
const CANVAS_H = 240;
const SPRITE_WORLD_WIDTH = 4.5; // widest a label may be in scene units

/** Opacity floor when the camera pulls far away (visual-density reduction). */
export const LABEL_OPACITY_FLOOR = 0.3;

/** Korean primary text painted on the label sprite. */
export function labelText(data: CelestialBodyData): string {
  return data.nameKo;
}

/** English secondary text painted under the Korean primary (§11). */
export function secondaryLabelText(data: CelestialBodyData): string {
  return data.nameEn;
}

/**
 * Density/visibility rule for an in-scene label (§11). Non-moon bodies are
 * always eligible when labels are on (their crowding fade is handled by
 * `setCrowdFade`). Moon labels only reveal when their own system is focused:
 * the moon is selected, or its parent planet/dwarf is selected — keeping the
 * broad view free of 21 moon tags. The global moons toggle gates them too.
 */
export function shouldShowLabel(
  id: string,
  type: CelestialBodyData["type"],
  parentId: string | undefined,
  selectedId: string | null,
  moonsVisible: boolean,
): boolean {
  if (type === "moon") {
    if (!moonsVisible) return false;
    return selectedId === id || selectedId === parentId;
  }
  return true;
}

export class Labels {
  private sprites = new Map<string, THREE.Sprite>();
  private textures: THREE.CanvasTexture[] = [];
  private enabled = true;
  private moonsVisible = true;
  private selectedId: string | null = null;
  private crowdFade = 0; // 0 = zoomed in (full opacity) .. 1 = broad view (dim)
  private readonly moonIds = new Set<string>();
  private readonly bodyList: readonly CelestialBody[];

  constructor(bodies: readonly CelestialBody[]) {
    this.bodyList = bodies;
    for (const body of bodies) {
      if (body.data.type === "moon") this.moonIds.add(body.data.id);
      const sprite = this.createSprite(body.data);
      const sceneRadius = body.sceneRadius;
      sprite.position.set(0, sceneRadius * 1.7 + 0.6, 0);
      body.group.add(sprite);
      this.sprites.set(body.data.id, sprite);
    }
    this.applyVisibility();
  }

  /** Re-position every sprite above its body's current (possibly resized) sphere. */
  refreshPositions(): void {
    for (const body of this.bodyList) {
      const sprite = this.sprites.get(body.data.id);
      if (!sprite) continue;
      const sceneRadius = body.sceneRadius;
      sprite.position.set(0, sceneRadius * 1.7 + 0.6, 0);
    }
  }

  /** Recompose which moon labels are visible after the global moons toggle. */
  setMoonsVisible(visible: boolean): void {
    this.moonsVisible = visible;
    this.applyVisibility();
  }

  /**
   * Reveal moon labels when their own planetary system is focused (§11/§13):
   * pass the currently selected body id (or null when nothing is selected).
   * This is the "moon-label reveal on parent selection" behavior.
   */
  setSelection(selectedId: string | null): void {
    this.selectedId = selectedId;
    this.applyVisibility();
  }

  /**
   * Reduce visual density at broad views: fade every label toward the opacity
   * floor as the camera pulls away from its focus target (`far` in [0,1],
   * 0 = close, 1 = far). Keeps zoomed-in labels fully legible while the broad
   * Solar-system view stays uncluttered. Cheap property write, no allocation.
   */
  setCrowdFade(far: number): void {
    const f = Number.isFinite(far) ? Math.max(0, Math.min(1, far)) : 0;
    if (Math.abs(f - this.crowdFade) < 0.02) return;
    this.crowdFade = f;
    const opacity = 1 - (1 - LABEL_OPACITY_FLOOR) * f;
    for (const sprite of this.sprites.values()) {
      (sprite.material as THREE.SpriteMaterial).opacity = opacity;
    }
  }

  /** Single source of truth for each sprite's visibility. */
  private applyVisibility(): void {
    for (const body of this.bodyList) {
      const sprite = this.sprites.get(body.data.id);
      if (!sprite) continue;
      const d = body.data;
      sprite.visible =
        this.enabled &&
        shouldShowLabel(
          d.id,
          d.type,
          d.parentId,
          this.selectedId,
          this.moonsVisible,
        );
    }
  }

  private createSprite(data: CelestialBodyData): THREE.Sprite {
    const canvas = this.paint(data);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    this.textures.push(tex);

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: true,
      sizeAttenuation: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.userData.bodyId = data.id;
    sprite.userData.kind = data.type;
    sprite.scale.set(
      SPRITE_WORLD_WIDTH,
      (SPRITE_WORLD_WIDTH * CANVAS_H) / CANVAS_W,
      1,
    );
    sprite.visible = this.enabled;
    return sprite;
  }

  private paint(data: CelestialBodyData): HTMLCanvasElement {
    const ko = labelText(data);
    const en = secondaryLabelText(data);
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    const pad = 40;
    const radius = 26;
    const boxW = Math.min(CANVAS_W - pad * 2, 360);
    const boxH = CANVAS_H - pad;
    this.roundRect(ctx, pad, pad / 2, boxW, boxH, radius);
    ctx.fillStyle = "rgba(8, 12, 20, 0.78)";
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 215, 255, 0.5)";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Korean primary — large, centred on the upper half.
    ctx.font = `700 ${92}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(ko, CANVAS_W / 2, CANVAS_H / 2 - 22);

    // English secondary — smaller, dimmer, centred just below (§11).
    ctx.font = `600 ${42}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.fillStyle = "#c6d0e4";
    ctx.fillText(en, CANVAS_W / 2, CANVAS_H / 2 + 52);

    return canvas;
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  get enabledState(): boolean {
    return this.enabled;
  }

  setEnabled(visible: boolean): void {
    this.enabled = visible;
    this.applyVisibility();
  }

  get(id: string): THREE.Sprite | undefined {
    return this.sprites.get(id);
  }

  /** Release GPU resources owned by the label textures. */
  dispose(): void {
    for (const tex of this.textures) tex.dispose();
    this.textures = [];
    this.sprites.clear();
  }
}
