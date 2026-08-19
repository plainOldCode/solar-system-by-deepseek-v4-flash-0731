/**
 * Selection & navigation model — pure helpers for the interaction layer.
 *
 * Kept free of a WebGLRenderer and free of the DOM (only the Three.js type
 * namespace is imported for intersection objects) so ordering and target math
 * are unit-testable in Node, mirroring how the scene-construction tests drive
 * `SolarSystem.buildViews` headlessly.
 */

import type * as THREE from "three";
import { SOLAR_SYSTEM } from "../data/solarSystemData";

/** Navigation order: the authoritative dataset order (Sun → planets → moons). */
export const SELECTION_ORDER: readonly string[] = SOLAR_SYSTEM.map((b) => b.id);

/** Wrap `current` forward through `order` (start at the first entry if null). */
export function nextSelection(
  current: string | null,
  order: readonly string[] = SELECTION_ORDER,
): string {
  if (order.length === 0) return current ?? "";
  if (current === null) return order[0];
  const i = order.indexOf(current);
  if (i === -1) return order[0];
  return order[(i + 1) % order.length];
}

/** Wrap `current` backward through `order` (start at the last entry if null). */
export function prevSelection(
  current: string | null,
  order: readonly string[] = SELECTION_ORDER,
): string {
  if (order.length === 0) return current ?? "";
  if (current === null) return order[order.length - 1];
  const i = order.indexOf(current);
  if (i === -1) return order[order.length - 1];
  return order[(i - 1 + order.length) % order.length];
}

/**
 * Resolve the first body id along any of the raycast intersections, walking up
 * the object parent chain so hits on a body's mesh, label sprite, or orbit
 * line resolve to the owning body. Returns null when nothing maps to a body.
 */
export function bodyIdFromIntersects(
  intersects: readonly { object: THREE.Object3D }[],
): string | null {
  for (const hit of intersects) {
    let obj: THREE.Object3D | null = hit.object;
    while (obj) {
      const id = (obj as THREE.Object3D).userData?.bodyId;
      if (typeof id === "string" && id.length > 0) return id;
      obj = obj.parent;
    }
  }
  return null;
}

/**
 * Deterministic pick resolution: a body sphere always outranks an orbit guide
 * line, then among bodies the nearest (first, distance-sorted) wins. Orbit
 * lines can lie nearer the camera than a body's sphere along the same sight
 * line (e.g. Venus's ring crossing Earth's screen disc), so a merged
 * nearest-first list let a line shadow and mis-select the wrong body. Resolve
 * body meshes first; fall back to orbit-line hits only when no sphere is hit.
 */
export function resolveBodyPick(
  meshHits: readonly { object: THREE.Object3D }[],
  lineHits: readonly { object: THREE.Object3D }[],
): string | null {
  const meshId = bodyIdFromIntersects(meshHits);
  if (meshId) return meshId;
  return bodyIdFromIntersects(lineHits);
}

/**
 * Comfortable camera distance when explicitly focusing a body: scale to its
 * rendered sphere radius so small moons get close and the Sun pulls back,
 * clamped to a sane band that keeps the view inside scene bounds.
 */
export function focusDistanceFor(
  bodySceneRadius: number,
  min = 3,
  max = 120,
): number {
  const scaled = bodySceneRadius * 4;
  return Math.min(Math.max(scaled, min), max);
}
