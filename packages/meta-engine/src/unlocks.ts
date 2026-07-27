import type { CareerStats, Condition, GameSummary } from "./types.js";

export interface EvaluationContext {
  stats: CareerStats;
  summary: GameSummary;
  /** All badge keys in the catalog — only used by the "all_badges_unlocked" meta-condition. */
  catalogBadgeKeys: string[];
}

/**
 * The generic engine: one evaluator function per condition `type`. Adding a
 * new badge/achievement/title with an EXISTING condition type never touches
 * this file — only a genuinely new condition shape does (07_META_GAME.md
 * §1: "un moteur unique évalue les conditions").
 */
export function evaluateCondition(condition: Condition, ctx: EvaluationContext): boolean {
  const { stats, summary, catalogBadgeKeys } = ctx;

  switch (condition.type) {
    case "complete_family":
      return condition.species
        ? summary.familiesCompletedThisGame.includes(condition.species)
        : summary.familiesCompletedThisGame.length > 0;
    case "score_at_least":
      return summary.score >= condition.score;
    case "ended_with_zero_money":
      return summary.finalMoney === 0;
    case "consecutive_successful_bluffs_at_least":
      return stats.currentSuccessfulBluffStreak >= condition.count;
    case "successful_bluff_rate_at_least":
      return (
        stats.totalBluffs >= condition.minBluffs &&
        stats.totalSuccessfulBluffs / stats.totalBluffs >= condition.rate
      );
    case "bid_rounds_without_winning_at_least":
      return summary.maxConsecutiveBidRoundsWithoutWinning >= condition.rounds;
    case "total_collected_in_game_at_least":
      return summary.totalMoneyCollectedThisGame >= condition.amount;
    case "completed_family_on_final_turn":
      return summary.completedFamilyOnFinalTurn;
    case "kuhhandel_win_streak_at_least":
      return stats.currentKuhhandelWinStreak >= condition.count;
    case "distinct_families_career_at_least":
      return stats.distinctFamiliesCompletedEver.length >= condition.count;
    case "win_streak_at_least":
      return stats.currentWinStreak >= condition.count;
    case "overpay_ratio_at_least":
      return summary.maxOverpayRatio >= condition.ratio;
    case "all_in_kuhhandel_offer":
      return summary.hadAllInKuhhandelOffer;
    case "all_badges_unlocked":
      return catalogBadgeKeys.every((key) => stats.unlockedBadgeKeys.includes(key));
    case "level_at_least":
      return stats.level >= condition.level;
    case "lost_after_leading":
      return summary.lostAfterLeading;
    case "won_without_any_kuhhandel_win":
      return summary.won && summary.kuhhandelsWonThisGame === 0;
    case "last_player_connected_after_game":
      return summary.wasLastConnectedAfterGame;
    case "consecutive_kuhhandel_refusals_at_least":
      return summary.maxConsecutiveKuhhandelRefusalsThisGame >= condition.count;
  }
}

/** Works for any keyed+conditioned catalog (badges, achievements, or titles). */
export function evaluateUnlocks(
  catalog: { key: string; condition: Condition }[],
  ctx: EvaluationContext,
  alreadyUnlockedKeys: string[],
): string[] {
  const alreadyUnlocked = new Set(alreadyUnlockedKeys);
  return catalog
    .filter((entry) => !alreadyUnlocked.has(entry.key))
    .filter((entry) => evaluateCondition(entry.condition, ctx))
    .map((entry) => entry.key);
}
