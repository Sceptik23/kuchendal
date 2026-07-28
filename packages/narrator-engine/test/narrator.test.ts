import { describe, expect, it } from "vitest";
import { NARRATOR_EVENT_KEYS, NARRATOR_STYLES } from "../src/types.js";
import { NARRATOR_TEMPLATES } from "../src/config/templates.config.js";
import { TemplateNarratorProvider, pickWeighted } from "../src/provider.js";
import {
  isBigBid,
  isBluffRevealed,
  isBoldKuhhandelOffer,
  isComeback,
} from "../src/triggers.js";

describe("template catalog", () => {
  it("has at least one template for every style x event key combination", () => {
    for (const style of NARRATOR_STYLES) {
      for (const eventKey of NARRATOR_EVENT_KEYS) {
        expect(NARRATOR_TEMPLATES[style][eventKey].length).toBeGreaterThan(0);
      }
    }
  });
});

describe("pickWeighted", () => {
  it("returns null for an empty pool", () => {
    expect(pickWeighted([], Math.random)).toBeNull();
  });

  it("always returns the only entry in a single-item pool", () => {
    const pool = [{ weight: 1, value: "x" }];
    expect(pickWeighted(pool, () => 0.99)!.value).toBe("x");
  });

  it("respects weighting at the roll boundaries", () => {
    const pool = [
      { weight: 3, value: "common" },
      { weight: 1, value: "rare" },
    ];
    expect(pickWeighted(pool, () => 0)!.value).toBe("common");
    expect(pickWeighted(pool, () => 0.99)!.value).toBe("rare");
  });
});

describe("TemplateNarratorProvider", () => {
  it("fills placeholders into the selected template", () => {
    const provider = new TemplateNarratorProvider(() => 0);
    const message = provider.comment("sport", "bigBid", { player: "Alice", amount: 400, species: "vache" });
    expect(message).not.toBeNull();
    expect(message!.text).not.toMatch(/\{.*\}/);
    expect(message!.text).toContain("Alice");
  });
});

describe("triggers", () => {
  it("detects a big bid at/above the threshold only", () => {
    expect(isBigBid(299)).toBe(false);
    expect(isBigBid(300)).toBe(true);
  });

  it("detects a revealed bluff when the winner staked less than the loser", () => {
    expect(isBluffRevealed(100, 200)).toBe(true);
    expect(isBluffRevealed(200, 100)).toBe(false);
    expect(isBluffRevealed(100, 100)).toBe(false);
  });

  it("detects a bold offer as a high share of cash before the offer", () => {
    expect(isBoldKuhhandelOffer(700, 1000)).toBe(true);
    expect(isBoldKuhhandelOffer(100, 1000)).toBe(false);
    expect(isBoldKuhhandelOffer(100, 0)).toBe(false);
  });

  it("detects a comeback only when the leader actually changed", () => {
    expect(isComeback("p1", "p2")).toBe(true);
    expect(isComeback("p1", "p1")).toBe(false);
    expect(isComeback(null, "p1")).toBe(false);
  });
});
