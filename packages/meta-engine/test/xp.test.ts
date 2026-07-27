import { describe, expect, it } from "vitest";
import { xpCostForLevel } from "../src/config/xp.config.js";
import { xpThresholdForLevel, levelForXp } from "../src/xp.js";

describe("xpCostForLevel", () => {
  it("matches the 100 * n^1.4 curve from 07_META_GAME.md", () => {
    expect(xpCostForLevel(1)).toBe(100);
    expect(xpCostForLevel(2)).toBe(Math.round(100 * Math.pow(2, 1.4)));
  });
});

describe("xpThresholdForLevel", () => {
  it("requires zero cumulative XP to be at level 1", () => {
    expect(xpThresholdForLevel(1)).toBe(0);
  });

  it("requires exactly xpCostForLevel(1) to reach level 2", () => {
    expect(xpThresholdForLevel(2)).toBe(xpCostForLevel(1));
  });

  it("accumulates the cost of every prior level", () => {
    expect(xpThresholdForLevel(3)).toBe(xpCostForLevel(1) + xpCostForLevel(2));
  });
});

describe("levelForXp", () => {
  it("is level 1 below the level-2 threshold", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(xpThresholdForLevel(2) - 1)).toBe(1);
  });

  it("advances exactly at a threshold", () => {
    expect(levelForXp(xpThresholdForLevel(2))).toBe(2);
    expect(levelForXp(xpThresholdForLevel(3))).toBe(3);
  });

  it("never regresses for xp between thresholds", () => {
    expect(levelForXp(xpThresholdForLevel(3) - 1)).toBe(2);
  });
});
