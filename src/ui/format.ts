/**
 * InfoPanel data formatting — pure functions that turn a body's data record into
 * human-readable Korean UI strings. Extracted so the formatter is unit-testable
 * without a DOM; the InfoPanel class just injects the result into the DOM.
 */
import type { CelestialBodyData } from "../data/types";
import type { DistanceScaleMode, RadiusScaleMode } from "../core/ScaleManager";

/** Korean label for each body kind (matches `BodyType`). */
export const TYPE_LABEL_KO: Record<string, string> = {
  star: "별",
  planet: "행성",
  "dwarf-planet": "왜행성",
  moon: "위성",
};

/** Korean labels for the selectable distance scale modes (§4). */
export const DISTANCE_MODE_LABEL_KO: Record<DistanceScaleMode, string> = {
  log: "로그 스케일",
  linear: "선형 스케일",
  focus: "포커스 스케일",
};

/** Korean labels for the selectable body-size modes (§6). */
export const SIZE_MODE_LABEL_KO: Record<RadiusScaleMode, string> = {
  enhanced: "강화 표시 (기본)",
  relative: "상대 크기",
  uniform: "균일 마커",
};

function fmt(n: number | undefined, digits = 3): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return Number(n.toPrecision(digits)).toLocaleString("ko-KR", {
    maximumFractionDigits: digits,
  });
}

function distanceValue(data: CelestialBodyData): string {
  if (typeof data.semiMajorAxis !== "number" || !Number.isFinite(data.semiMajorAxis)) {
    return "—";
  }
  if (data.semiMajorAxisUnit === "AU") return `${fmt(data.semiMajorAxis, 4)} AU`;
  return `${Number(data.semiMajorAxis).toLocaleString("ko-KR")} km`;
}

export interface BodyInfo {
  titleKo: string;
  titleEn: string;
  typeKo: string;
  color: string;
  distance: string;
  radius: string;
  period: string;
  rotation: string;
  axialTilt: string;
  description: string;
}

export function formatBodyInfo(data: CelestialBodyData): BodyInfo {
  return {
    titleKo: data.nameKo,
    titleEn: data.nameEn,
    typeKo: TYPE_LABEL_KO[data.type] ?? data.type,
    color: data.displayColor,
    distance: distanceValue(data),
    radius: `${Number(data.radiusKm).toLocaleString("ko-KR")} km`,
    period: data.orbitalPeriodDays != null ? `${fmt(data.orbitalPeriodDays, 4)} 일` : "—",
    rotation:
      data.rotationPeriodHours != null
        ? `${fmt(data.rotationPeriodHours, 4)} 시간`
        : "—",
    axialTilt:
      data.axialTiltDeg != null ? `${fmt(data.axialTiltDeg, 4)}°` : "—",
    description: data.description ?? "",
  };
}

/** Short screen-reader + tooltip alt text for a body. */
export function bodyAlt(data: CelestialBodyData): string {
  const type = TYPE_LABEL_KO[data.type] ?? data.type;
  return `${data.nameKo} (${data.nameEn}), ${type}`;
}

/**
 * Format elapsed simulation days as a compact, live HUD string. Sub-day
 * amounts are shown in hours so the read-out visibly ticks even at slow
 * speeds; once past a day it shows days. Values are clamped to the valid
 * domain so it never prints NaN/Infinity.
 */
export function formatSimDays(days: number): string {
  if (!Number.isFinite(days) || days < 0) return "0시간";
  if (days < 1) {
    const hours = days * 24;
    return `${hours.toFixed(1)}시간`;
  }
  if (days < 100) return `${days.toFixed(1)}일`;
  return `${Math.round(days).toLocaleString("ko-KR")}일`;
}
