import { describe, expect, it } from "vitest";
import { createInitialCareerStats, type GameSummary } from "../src/types.js";
import { applyGameResult } from "../src/applyGameResult.js";
import { XP_SOURCES } from "../src/config/xp.config.js";

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

describe("applyGameResult — the single entry point apps/realtime-server calls", () => {
  it("awards participation XP for every game", () => {
    const result = applyGameResult(createInitialCareerStats(), summary());
    expect(result.xpGained).toBeGreaterThanOrEqual(XP_SOURCES.PARTICIPATION);
  });

  it("awards victory XP plus a first-victory-ever bonus on a first win", () => {
    // kuhhandelsWonThisGame: 1 avoids incidentally satisfying the (real,
    // separate) "won without any Kuhhandel win" achievement, keeping this
    // test focused on victory XP alone.
    const result = applyGameResult(
      createInitialCareerStats(),
      summary({ won: true, kuhhandelsWonThisGame: 1 }),
    );
    // This first game also happens to be this player's first-ever Kuhhandel
    // win, so that (real, separate) one-time bonus applies too.
    expect(result.xpGained).toBe(
      XP_SOURCES.PARTICIPATION +
        XP_SOURCES.VICTORY +
        XP_SOURCES.FIRST_VICTORY_EVER +
        XP_SOURCES.FIRST_KUHHANDEL_EVER,
    );
  });

  it("does not repeat the first-victory bonus on a later win", () => {
    let stats = createInitialCareerStats();
    stats = applyGameResult(
      stats,
      summary({ won: true, kuhhandelsWonThisGame: 1 }),
    ).nextStats;
    // A loss in between resets the win streak, isolating this assertion
    // from the (real, separate) consecutive-win-streak XP bonus.
    stats = applyGameResult(stats, summary({ won: false })).nextStats;
    const third = applyGameResult(
      stats,
      summary({ won: true, kuhhandelsWonThisGame: 1 }),
    );
    expect(third.xpGained).toBe(XP_SOURCES.PARTICIPATION + XP_SOURCES.VICTORY);
  });

  it("awards XP per family completed this game", () => {
    // "oie"/"mouton" avoid incidentally satisfying the (real, separate)
    // "roi_des_vaches" badge, which only cares about the vache family.
    const result = applyGameResult(
      createInitialCareerStats(),
      summary({ familiesCompletedThisGame: ["oie", "mouton"] }),
    );
    expect(result.xpGained).toBe(
      XP_SOURCES.PARTICIPATION + XP_SOURCES.FAMILY_COMPLETED * 2,
    );
  });

  it("returns newly unlocked badges and folds their XP bonus into xpGained", () => {
    const result = applyGameResult(
      createInitialCareerStats(),
      summary({ finalMoney: 0 }),
    );
    expect(result.newlyUnlockedBadgeKeys).toContain("faillite");
    expect(result.nextStats.unlockedBadgeKeys).toContain("faillite");
  });

  it("recomputes level from the updated total XP", () => {
    const bigWin = summary({ won: true, score: 5000, familiesCompletedThisGame: ["vache"] });
    const result = applyGameResult(createInitialCareerStats(), bigWin);
    expect(result.nextStats.level).toBeGreaterThanOrEqual(1);
    expect(result.nextStats.xp).toBe(result.xpGained);
  });

  it("unlocks a title once the level threshold it maps to is reached", () => {
    // Force enough XP in one game to certainly cross the first title's level.
    const result = applyGameResult(
      createInitialCareerStats(),
      summary({ won: true, score: 100000, familiesCompletedThisGame: ["vache", "cochon", "oie", "chevre"] }),
    );
    expect(result.newlyUnlockedTitleKeys.length).toBeGreaterThan(0);
    expect(result.nextStats.unlockedTitleKeys).toEqual(
      expect.arrayContaining(result.newlyUnlockedTitleKeys),
    );
  });
});
