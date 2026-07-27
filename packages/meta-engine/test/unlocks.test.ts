import { describe, expect, it } from "vitest";
import { createInitialCareerStats, type CareerStats, type CatalogEntry, type GameSummary } from "../src/types.js";
import { evaluateCondition, evaluateUnlocks, type EvaluationContext } from "../src/unlocks.js";

function stats(overrides: Partial<CareerStats> = {}): CareerStats {
  return { ...createInitialCareerStats(), ...overrides };
}

function summary(overrides: Partial<GameSummary> = {}): GameSummary {
  return {
    won: false,
    score: 0,
    finalMoney: 100,
    familiesCompletedThisGame: [],
    completedFamilyOnFinalTurn: false,
    maxConsecutiveBidRoundsWithoutWinning: 0,
    totalMoneyCollectedThisGame: 0,
    maxOverpayRatio: 0,
    hadAllInKuhhandelOffer: false,
    kuhhandelsWonThisGame: 0,
    kuhhandelsLostThisGame: 0,
    successfulBluffsThisGame: 0,
    totalBluffsThisGame: 0,
    lostAfterLeading: false,
    maxConsecutiveKuhhandelRefusalsThisGame: 0,
    wasLastConnectedAfterGame: false,
    ...overrides,
  };
}

function ctx(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return { stats: stats(), summary: summary(), catalogBadgeKeys: [], ...overrides };
}

describe("evaluateCondition — one evaluator per declarative condition type", () => {
  it("score_at_least reads this game's score", () => {
    expect(
      evaluateCondition({ type: "score_at_least", score: 1000 }, ctx({ summary: summary({ score: 1200 }) })),
    ).toBe(true);
    expect(
      evaluateCondition({ type: "score_at_least", score: 1000 }, ctx({ summary: summary({ score: 500 }) })),
    ).toBe(false);
  });

  it("ended_with_zero_money", () => {
    expect(
      evaluateCondition({ type: "ended_with_zero_money" }, ctx({ summary: summary({ finalMoney: 0 }) })),
    ).toBe(true);
    expect(
      evaluateCondition({ type: "ended_with_zero_money" }, ctx({ summary: summary({ finalMoney: 5 }) })),
    ).toBe(false);
  });

  it("complete_family matches a specific species when given, any family otherwise", () => {
    const withVache = ctx({ summary: summary({ familiesCompletedThisGame: ["vache"] }) });
    expect(evaluateCondition({ type: "complete_family", species: "vache" }, withVache)).toBe(true);
    expect(evaluateCondition({ type: "complete_family", species: "cochon" }, withVache)).toBe(false);
    expect(evaluateCondition({ type: "complete_family" }, withVache)).toBe(true);
  });

  it("overpay_ratio_at_least", () => {
    expect(
      evaluateCondition(
        { type: "overpay_ratio_at_least", ratio: 5 },
        ctx({ summary: summary({ maxOverpayRatio: 6 }) }),
      ),
    ).toBe(true);
  });

  it("total_collected_in_game_at_least", () => {
    expect(
      evaluateCondition(
        { type: "total_collected_in_game_at_least", amount: 500 },
        ctx({ summary: summary({ totalMoneyCollectedThisGame: 600 }) }),
      ),
    ).toBe(true);
  });

  it("all_in_kuhhandel_offer", () => {
    expect(
      evaluateCondition(
        { type: "all_in_kuhhandel_offer" },
        ctx({ summary: summary({ hadAllInKuhhandelOffer: true }) }),
      ),
    ).toBe(true);
  });

  it("completed_family_on_final_turn", () => {
    expect(
      evaluateCondition(
        { type: "completed_family_on_final_turn" },
        ctx({ summary: summary({ completedFamilyOnFinalTurn: true }) }),
      ),
    ).toBe(true);
  });

  it("bid_rounds_without_winning_at_least", () => {
    expect(
      evaluateCondition(
        { type: "bid_rounds_without_winning_at_least", rounds: 3 },
        ctx({ summary: summary({ maxConsecutiveBidRoundsWithoutWinning: 4 }) }),
      ),
    ).toBe(true);
  });

  it("won_without_any_kuhhandel_win", () => {
    expect(
      evaluateCondition(
        { type: "won_without_any_kuhhandel_win" },
        ctx({ summary: summary({ won: true, kuhhandelsWonThisGame: 0 }) }),
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: "won_without_any_kuhhandel_win" },
        ctx({ summary: summary({ won: true, kuhhandelsWonThisGame: 1 }) }),
      ),
    ).toBe(false);
  });

  it("consecutive_kuhhandel_refusals_at_least", () => {
    expect(
      evaluateCondition(
        { type: "consecutive_kuhhandel_refusals_at_least", count: 5 },
        ctx({ summary: summary({ maxConsecutiveKuhhandelRefusalsThisGame: 5 }) }),
      ),
    ).toBe(true);
  });

  it("lost_after_leading", () => {
    expect(
      evaluateCondition(
        { type: "lost_after_leading" },
        ctx({ summary: summary({ lostAfterLeading: true }) }),
      ),
    ).toBe(true);
  });

  it("last_player_connected_after_game (not wired yet, always false in Phase 6)", () => {
    expect(
      evaluateCondition(
        { type: "last_player_connected_after_game" },
        ctx({ summary: summary({ wasLastConnectedAfterGame: false }) }),
      ),
    ).toBe(false);
  });

  it("distinct_families_career_at_least reads cumulative career stats", () => {
    const s = stats({ distinctFamiliesCompletedEver: ["vache", "cochon", "oie"] });
    expect(
      evaluateCondition({ type: "distinct_families_career_at_least", count: 3 }, ctx({ stats: s })),
    ).toBe(true);
    expect(
      evaluateCondition({ type: "distinct_families_career_at_least", count: 4 }, ctx({ stats: s })),
    ).toBe(false);
  });

  it("win_streak_at_least and kuhhandel_win_streak_at_least read career streaks", () => {
    expect(
      evaluateCondition(
        { type: "win_streak_at_least", count: 5 },
        ctx({ stats: stats({ currentWinStreak: 5 }) }),
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: "kuhhandel_win_streak_at_least", count: 3 },
        ctx({ stats: stats({ currentKuhhandelWinStreak: 3 }) }),
      ),
    ).toBe(true);
  });

  it("consecutive_successful_bluffs_at_least reads the career bluff streak", () => {
    expect(
      evaluateCondition(
        { type: "consecutive_successful_bluffs_at_least", count: 10 },
        ctx({ stats: stats({ currentSuccessfulBluffStreak: 10 }) }),
      ),
    ).toBe(true);
  });

  it("successful_bluff_rate_at_least requires the minimum sample size too", () => {
    const highRateLowVolume = stats({ totalBluffs: 10, totalSuccessfulBluffs: 10 });
    expect(
      evaluateCondition(
        { type: "successful_bluff_rate_at_least", rate: 0.9, minBluffs: 50 },
        ctx({ stats: highRateLowVolume }),
      ),
    ).toBe(false);

    const qualifies = stats({ totalBluffs: 50, totalSuccessfulBluffs: 46 });
    expect(
      evaluateCondition(
        { type: "successful_bluff_rate_at_least", rate: 0.9, minBluffs: 50 },
        ctx({ stats: qualifies }),
      ),
    ).toBe(true);
  });

  it("level_at_least reads the career level", () => {
    const s = stats({ level: 5 });
    expect(evaluateCondition({ type: "level_at_least", level: 5 }, ctx({ stats: s }))).toBe(true);
    expect(evaluateCondition({ type: "level_at_least", level: 6 }, ctx({ stats: s }))).toBe(false);
  });

  it("all_badges_unlocked checks every other badge in the catalog is already unlocked", () => {
    const s = stats({ unlockedBadgeKeys: ["a", "b"] });
    expect(
      evaluateCondition(
        { type: "all_badges_unlocked" },
        ctx({ stats: s, catalogBadgeKeys: ["a", "b"] }),
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: "all_badges_unlocked" },
        ctx({ stats: s, catalogBadgeKeys: ["a", "b", "c"] }),
      ),
    ).toBe(false);
  });
});

describe("evaluateUnlocks — generic engine over a catalog", () => {
  const catalog: CatalogEntry[] = [
    {
      key: "collectionneur",
      name: "Collectionneur",
      description: "",
      rarity: "rare",
      isSecret: false,
      condition: { type: "distinct_families_career_at_least", count: 3 },
    },
    {
      key: "millionnaire",
      name: "Millionnaire",
      description: "",
      rarity: "rare",
      isSecret: false,
      condition: { type: "score_at_least", score: 1000 },
    },
  ];

  it("returns only newly-qualifying keys, never ones already unlocked", () => {
    const context = ctx({
      stats: stats({
        distinctFamiliesCompletedEver: ["vache", "cochon", "oie"],
        unlockedBadgeKeys: ["collectionneur"],
      }),
      summary: summary({ score: 500 }),
    });

    const newly = evaluateUnlocks(catalog, context, ["collectionneur"]);

    expect(newly).toEqual([]);
  });

  it("unlocks everything that newly qualifies in one pass", () => {
    const context = ctx({
      stats: stats({ distinctFamiliesCompletedEver: ["vache", "cochon", "oie"] }),
      summary: summary({ score: 1500 }),
    });

    const newly = evaluateUnlocks(catalog, context, []);

    expect(newly.sort()).toEqual(["collectionneur", "millionnaire"]);
  });
});
