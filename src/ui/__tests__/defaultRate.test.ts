import { describe, it, expect } from "vitest";
import {
  DEFAULT_SPEED_DAYS,
  SPEED_LADDER_DAYS,
} from "../AppController";

const OLD_DEFAULT_DAYS_PER_SEC = 1; // original "1 second = 1 day" spec baseline
const OLD_LADDER = [1, 2, 5, 10, 30, 100, 365, 1000, 3650, 10000];

describe("default simulation rate (one tenth reduction)", () => {
  it("new default is exactly one tenth of the original default", () => {
    expect(DEFAULT_SPEED_DAYS).toBeCloseTo(OLD_DEFAULT_DAYS_PER_SEC / 10, 10);
  });

  it("new default equals the bottom rung of the ladder (stepping down is disabled at default)", () => {
    expect(SPEED_LADDER_DAYS[0]).toBe(DEFAULT_SPEED_DAYS);
  });

  it("every ladder rung is exactly one tenth of the original rung (shared simulation-time level)", () => {
    expect(SPEED_LADDER_DAYS).toHaveLength(OLD_LADDER.length);
    for (let i = 0; i < OLD_LADDER.length; i++) {
      expect(SPEED_LADDER_DAYS[i]).toBeCloseTo(OLD_LADDER[i] / 10, 10);
    }
  });
});
