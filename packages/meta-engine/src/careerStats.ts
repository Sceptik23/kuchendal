import type { CareerStats, GameSummary } from "./types.js";

export function updateCareerStats(prev: CareerStats, summary: GameSummary): CareerStats {
  const currentWinStreak = summary.won ? prev.currentWinStreak + 1 : 0;
  const currentKuhhandelWinStreak =
    summary.kuhhandelsLostThisGame > 0
      ? 0
      : prev.currentKuhhandelWinStreak + summary.kuhhandelsWonThisGame;

  const currentSuccessfulBluffStreak =
    summary.totalBluffsThisGame === 0
      ? prev.currentSuccessfulBluffStreak
      : summary.successfulBluffsThisGame === summary.totalBluffsThisGame
        ? prev.currentSuccessfulBluffStreak + summary.successfulBluffsThisGame
        : summary.successfulBluffsThisGame;

  const distinctFamiliesCompletedEver = Array.from(
    new Set([...prev.distinctFamiliesCompletedEver, ...summary.familiesCompletedThisGame]),
  );

  return {
    gamesPlayed: prev.gamesPlayed + 1,
    gamesWon: prev.gamesWon + (summary.won ? 1 : 0),
    currentWinStreak,
    bestWinStreak: Math.max(prev.bestWinStreak, currentWinStreak),
    currentKuhhandelWinStreak,
    bestKuhhandelWinStreak: Math.max(prev.bestKuhhandelWinStreak, currentKuhhandelWinStreak),
    distinctFamiliesCompletedEver,
    totalBluffs: prev.totalBluffs + summary.totalBluffsThisGame,
    totalSuccessfulBluffs: prev.totalSuccessfulBluffs + summary.successfulBluffsThisGame,
    currentSuccessfulBluffStreak,
    bestSuccessfulBluffStreak: Math.max(
      prev.bestSuccessfulBluffStreak,
      currentSuccessfulBluffStreak,
    ),
    unlockedBadgeKeys: prev.unlockedBadgeKeys,
    unlockedAchievementKeys: prev.unlockedAchievementKeys,
    unlockedTitleKeys: prev.unlockedTitleKeys,
    xp: prev.xp,
    level: prev.level,
    isFirstGameEver: false,
  };
}
