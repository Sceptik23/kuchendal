import { applyGameResult, createInitialCareerStats, type CareerStats, type GameSummary } from "@kuhhandel/meta-engine";
import type { GamePersistenceAdapter } from "../persistence/types.js";

/**
 * Loads a player's cross-game progression, applies the pure meta-engine to
 * this game's summary, and persists the result — the only place GameRoom
 * touches packages/meta-engine, keeping the engine itself free of any
 * network/DB dependency (03_ARCHITECTURE.md §3).
 */
export async function awardGameProgress(
  persistence: GamePersistenceAdapter,
  userId: string,
  summary: GameSummary,
): Promise<void> {
  const prevStats = ((await persistence.loadCareerStats(userId)) as CareerStats | null) ??
    createInitialCareerStats();
  const outcome = applyGameResult(prevStats, summary);
  await persistence.saveCareerProgress(
    userId,
    outcome.nextStats,
    outcome.newlyUnlockedBadgeKeys,
    outcome.newlyUnlockedAchievementKeys,
    outcome.newlyUnlockedTitleKeys,
  );
}
