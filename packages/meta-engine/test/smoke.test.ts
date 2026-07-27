import { describe, expect, it } from "vitest";
import { BADGES, ACHIEVEMENTS, TITLES } from "../src/index.js";

describe("meta-engine package exports", () => {
  it("exposes the v1 sample catalog via the public entry point", () => {
    expect(BADGES.length).toBeGreaterThan(0);
    expect(ACHIEVEMENTS.length).toBeGreaterThan(0);
    expect(TITLES.length).toBeGreaterThan(0);
  });
});
