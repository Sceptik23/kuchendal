import { describe, expect, it } from "vitest";
import { createInitialCareerStats, type GameSummary } from "../src/types.js";
import { updateCareerStats } from "../src/careerStats.js";

function baseSummary(overrides: Partial<GameSummary> = {}): GameSummary {
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

describe("updateCareerStats — game count and win streaks", () => {
  it("increments gamesPlayed and clears isFirstGameEver", () => {
    const stats = updateCareerStats(createInitialCareerStats(), baseSummary());
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.isFirstGameEver).toBe(false);
  });

  it("grows the win streak on consecutive wins and tracks the best", () => {
    let stats = createInitialCareerStats();
    stats = updateCareerStats(stats, baseSummary({ won: true }));
    stats = updateCareerStats(stats, baseSummary({ won: true }));
    expect(stats.currentWinStreak).toBe(2);
    expect(stats.bestWinStreak).toBe(2);
  });

  it("resets the win streak to zero on a loss", () => {
    let stats = createInitialCareerStats();
    stats = updateCareerStats(stats, baseSummary({ won: true }));
    stats = updateCareerStats(stats, baseSummary({ won: false }));
    expect(stats.currentWinStreak).toBe(0);
    expect(stats.bestWinStreak).toBe(1);
  });
});

describe("updateCareerStats — Kuhhandel win streak", () => {
  it("grows only while every Kuhhandel played this game was won", () => {
    let stats = createInitialCareerStats();
    stats = updateCareerStats(stats, baseSummary({ kuhhandelsWonThisGame: 2 }));
    expect(stats.currentKuhhandelWinStreak).toBe(2);
  });

  it("resets the streak if any Kuhhandel is lost this game", () => {
    let stats = createInitialCareerStats();
    stats = updateCareerStats(stats, baseSummary({ kuhhandelsWonThisGame: 2 }));
    stats = updateCareerStats(stats, baseSummary({ kuhhandelsLostThisGame: 1 }));
    expect(stats.currentKuhhandelWinStreak).toBe(0);
  });
});

describe("updateCareerStats — families and bluffs across a career", () => {
  it("accumulates distinct completed families without duplicates", () => {
    let stats = createInitialCareerStats();
    stats = updateCareerStats(stats, baseSummary({ familiesCompletedThisGame: ["vache"] }));
    stats = updateCareerStats(
      stats,
      baseSummary({ familiesCompletedThisGame: ["vache", "cochon"] }),
    );
    expect(stats.distinctFamiliesCompletedEver.sort()).toEqual(["cochon", "vache"]);
  });

  it("tracks the successful-bluff streak across games and resets on a failed bluff", () => {
    let stats = createInitialCareerStats();
    stats = updateCareerStats(
      stats,
      baseSummary({ successfulBluffsThisGame: 3, totalBluffsThisGame: 3 }),
    );
    expect(stats.currentSuccessfulBluffStreak).toBe(3);

    stats = updateCareerStats(
      stats,
      baseSummary({ successfulBluffsThisGame: 1, totalBluffsThisGame: 2 }),
    );
    // one success, one failure this game — the failure breaks the streak,
    // leaving only the trailing success.
    expect(stats.currentSuccessfulBluffStreak).toBe(1);
    expect(stats.totalBluffs).toBe(5);
    expect(stats.totalSuccessfulBluffs).toBe(4);
  });
});
