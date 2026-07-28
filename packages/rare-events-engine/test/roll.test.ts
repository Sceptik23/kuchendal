import { describe, expect, it } from "vitest";
import { RARE_EVENTS } from "../src/config/rareEvents.config.js";
import { RARE_EVENT_CHANCE_PER_TURN, rollRareEvent } from "../src/roll.js";

function queue(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("catalog", () => {
  it("has between 15 and 20 entries (09_IMPLEMENTATION_PLAN.md Phase 8 scope)", () => {
    expect(RARE_EVENTS.length).toBeGreaterThanOrEqual(15);
    expect(RARE_EVENTS.length).toBeLessThanOrEqual(20);
  });

  it("every entry has a unique key and non-empty flavor/vfx/sound", () => {
    const keys = new Set(RARE_EVENTS.map((e) => e.key));
    expect(keys.size).toBe(RARE_EVENTS.length);
    for (const entry of RARE_EVENTS) {
      expect(entry.flavorText.length).toBeGreaterThan(0);
      expect(entry.vfx.length).toBeGreaterThan(0);
      expect(entry.sound.length).toBeGreaterThan(0);
    }
  });
});

describe("rollRareEvent", () => {
  it("never triggers when the gate roll is at/above the chance threshold", () => {
    const rng = queue([RARE_EVENT_CHANCE_PER_TURN]);
    expect(rollRareEvent(rng)).toBeNull();
  });

  it("triggers and returns a catalog entry when the gate roll clears the threshold", () => {
    const rng = queue([0, 0]);
    const event = rollRareEvent(rng);
    expect(event).not.toBeNull();
    expect(RARE_EVENTS).toContainEqual(event);
  });

  it("picks the last entry when the weighted roll lands past the total weight", () => {
    const rng = queue([0, 0.999999]);
    const event = rollRareEvent(rng);
    expect(event).toEqual(RARE_EVENTS[RARE_EVENTS.length - 1]);
  });

  it("returns null for an empty catalog regardless of rng", () => {
    expect(rollRareEvent(() => 0, [])).toBeNull();
  });
});
