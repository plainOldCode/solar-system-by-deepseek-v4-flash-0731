import { describe, it, expect } from "vitest";
import {
  togglePanelVisibility,
  panelsPressed,
  inBarToggleLabel,
  affordanceLabel,
  HIDDEN_TARGETS,
  SHOW_AFFORDANCE_SELECTOR,
  HUD_HIDDEN_CLASS,
} from "../hudVisibility";

describe("hudVisibility semantics", () => {
  it("toggles visible <-> hidden", () => {
    expect(togglePanelVisibility("visible")).toBe("hidden");
    expect(togglePanelVisibility("hidden")).toBe("visible");
  });

  it("aria-pressed reflects whether the HUD group is shown", () => {
    expect(panelsPressed(true)).toBe("true");
    expect(panelsPressed(false)).toBe("false");
  });

  it("in-bar toggle label describes the action it will perform", () => {
    expect(inBarToggleLabel(true)).toBe("패널 숨기기");
    expect(inBarToggleLabel(false)).toBe("패널 표시");
  });

  it("persistent affordance keeps an explicit accessible name", () => {
    expect(affordanceLabel(false)).toBe("패널 표시");
    expect(affordanceLabel(true)).toBe("패널 숨기기");
  });

  it("hiding collapses header, panels, control bar and hint as a group", () => {
    for (const s of [".hud-header", ".info-panel", ".control-bar", ".kb-hint"]) {
      expect(HIDDEN_TARGETS).toContain(s);
    }
  });

  it("the persistent affordance is NOT part of the hidden group", () => {
    expect(HIDDEN_TARGETS).not.toContain(SHOW_AFFORDANCE_SELECTOR);
    expect(HIDDEN_TARGETS.some((s) => s.includes("show-panels"))).toBe(false);
  });

  it("uses one root class + a distinct affordance id for styling", () => {
    expect(HUD_HIDDEN_CLASS).toBe("hud-hidden");
    expect(SHOW_AFFORDANCE_SELECTOR).toBe("#show-panels");
  });
});
