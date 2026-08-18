/**
 * Labels — in-scene name tags rendered as billboarded sprites above each body.
 *
 * A label is a small rounded-box canvas painted with the body's Korean name,
 * wrapped in a `CanvasTexture` and drawn as a `THREE.Sprite` child of the
 * body's group. Because it is a child of the group it travels with the planet
 * automatically; `depthTest` keeps it hidden behind nearer bodies. No external
 * assets are fetched — every label is generated at runtime, so there is no
 * network-load failure path to handle.
 */
import * as THREE from "three";
import type { CelestialBodyData } from "../data/types";
import type { CelestialBody } from "../core/CelestialBody";

const CANVAS_W = 512;
const CANVAS_H = 160;
const SPRITE_WORLD_WIDTH = 4.5; // widest a label may be in scene units

/** Korean text painted on the label sprite. */
export function labelText(data: CelestialBodyData): string {
  return data.nameKo;
}

export class Labels {
  private sprites = new Map<string, THREE.Sprite>();
  private textures: THREE.CanvasTexture[] = [];
  private enabled = true;

  constructor(bodies: readonly CelestialBody[]) {
    for (const body of bodies) {
      const sprite = this.createSprite(body.data);
      const sceneRadius = meshSceneRadius(body.mesh);
      sprite.position.set(0, sceneRadius * 1.7 + 0.45, 0);
      body.group.add(sprite);
      this.sprites.set(body.data.id, sprite);
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
    const text = labelText(data);
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    const pad = 36;
    const radius = 28;
    const boxW = Math.min(CANVAS_W - pad * 2, 320);
    const boxH = CANVAS_H - pad;
    this.roundRect(ctx, pad, pad / 2, boxW, boxH, radius);
    ctx.fillStyle = "rgba(8, 12, 20, 0.78)";
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 215, 255, 0.5)";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.font = `700 ${72}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2 + 6);
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
    for (const sprite of this.sprites.values()) sprite.visible = visible;
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

/** Read the scene radius the body mesh was built with. */
function meshSceneRadius(mesh: THREE.Mesh): number {
  const params = (mesh.geometry as THREE.SphereGeometry).parameters;
  return typeof params.radius === "number" && Number.isFinite(params.radius)
    ? params.radius
    : 1;
}
