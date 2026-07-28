import { describe, expect, it } from "vitest";
import { computeDistinctions } from "../src/computeDistinctions.js";
import type { PlayerDistinctionFacts } from "../src/types.js";

function facts(overrides: Partial<PlayerDistinctionFacts> & { playerId: string }): PlayerDistinctionFacts {
  return {
    maxBluffGap: 0,
    maxArnaqueRatio: 0,
    maxOverpayRatio: 0,
    comebackDelta: 0,
    kuhhandelWinsCount: 0,
    avgKuhhandelWinStake: 0,
    ...overrides,
  };
}

describe("computeDistinctions", () => {
  it("awards bluff_annee to the largest bluff gap", () => {
    const entries = computeDistinctions([
      facts({ playerId: "p1", maxBluffGap: 150 }),
      facts({ playerId: "p2", maxBluffGap: 50 }),
    ]);
    expect(entries).toContainEqual({ playerId: "p1", key: "bluff_annee", metricValue: 150 });
  });

  it("produces no entry for a metric nobody qualifies for", () => {
    const entries = computeDistinctions([facts({ playerId: "p1" }), facts({ playerId: "p2" })]);
    expect(entries.find((e) => e.key === "bluff_annee")).toBeUndefined();
    expect(entries.find((e) => e.key === "ministre_arnaque")).toBeUndefined();
    expect(entries).toHaveLength(0);
  });

  it("awards meilleur_acteur to the best wins/average-stake ratio, ignoring non-winners", () => {
    const entries = computeDistinctions([
      facts({ playerId: "p1", kuhhandelWinsCount: 5, avgKuhhandelWinStake: 2 }),
      facts({ playerId: "p2", kuhhandelWinsCount: 1, avgKuhhandelWinStake: 5 }),
      facts({ playerId: "p3" }), // never won a Kuhhandel
    ]);
    const meilleurActeur = entries.find((e) => e.key === "meilleur_acteur");
    expect(meilleurActeur?.playerId).toBe("p1");
  });

  it("awards pigeon_cosmique only above the 1x overpay threshold", () => {
    const entries = computeDistinctions([
      facts({ playerId: "p1", maxOverpayRatio: 0.8 }),
      facts({ playerId: "p2", maxOverpayRatio: 3.5 }),
    ]);
    expect(entries).toContainEqual({ playerId: "p2", key: "pigeon_cosmique", metricValue: 3.5 });
  });

  it("awards banquier_dimanche to the biggest positive comeback delta", () => {
    const entries = computeDistinctions([
      facts({ playerId: "p1", comebackDelta: -2 }),
      facts({ playerId: "p2", comebackDelta: 3 }),
    ]);
    expect(entries).toContainEqual({ playerId: "p2", key: "banquier_dimanche", metricValue: 3 });
  });

  it("never awards the same distinction to more than one player", () => {
    const entries = computeDistinctions([
      facts({ playerId: "p1", maxBluffGap: 100 }),
      facts({ playerId: "p2", maxBluffGap: 100 }),
    ]);
    expect(entries.filter((e) => e.key === "bluff_annee")).toHaveLength(1);
  });
});
