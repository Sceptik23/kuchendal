export type Rarity =
  | "commun"
  | "rare"
  | "epique"
  | "legendaire"
  | "mythique"
  | "secret"
  | "ultra_secret";

/**
 * Declarative condition — the generic engine (unlocks.ts) dispatches on
 * `type` to a registered evaluator. Adding a new badge/achievement/title
 * never requires touching the engine, only adding a catalog entry (and, if
 * it's a genuinely new condition shape, one evaluator function).
 */
export type Condition =
  | { type: "complete_family"; species?: string }
  | { type: "score_at_least"; score: number }
  | { type: "ended_with_zero_money" }
  | { type: "consecutive_successful_bluffs_at_least"; count: number }
  | { type: "successful_bluff_rate_at_least"; rate: number; minBluffs: number }
  | { type: "bid_rounds_without_winning_at_least"; rounds: number }
  | { type: "total_collected_in_game_at_least"; amount: number }
  | { type: "completed_family_on_final_turn" }
  | { type: "kuhhandel_win_streak_at_least"; count: number }
  | { type: "distinct_families_career_at_least"; count: number }
  | { type: "win_streak_at_least"; count: number }
  | { type: "overpay_ratio_at_least"; ratio: number }
  | { type: "all_in_kuhhandel_offer" }
  | { type: "all_badges_unlocked" }
  | { type: "level_at_least"; level: number }
  | { type: "lost_after_leading" }
  | { type: "won_without_any_kuhhandel_win" }
  | { type: "last_player_connected_after_game" }
  | { type: "consecutive_kuhhandel_refusals_at_least"; count: number };

export interface CatalogEntry {
  key: string;
  name: string;
  description: string;
  rarity: Rarity;
  isSecret: boolean;
  condition: Condition;
}

export interface TitleEntry {
  key: string;
  name: string;
  condition: Condition;
}

/**
 * Per-game facts the engine needs to evaluate this game's conditions.
 * Built by the caller (apps/realtime-server) from what GameRoom observed
 * during play — the engine itself never touches the network or a socket.
 */
export interface GameSummary {
  won: boolean;
  score: number;
  finalMoney: number;
  familiesCompletedThisGame: string[];
  completedFamilyOnFinalTurn: boolean;
  maxConsecutiveBidRoundsWithoutWinning: number;
  totalMoneyCollectedThisGame: number;
  maxOverpayRatio: number;
  hadAllInKuhhandelOffer: boolean;
  kuhhandelsWonThisGame: number;
  kuhhandelsLostThisGame: number;
  successfulBluffsThisGame: number;
  totalBluffsThisGame: number;
  lostAfterLeading: boolean;
  maxConsecutiveKuhhandelRefusalsThisGame: number;
  /**
   * Always false in Phase 6 — detecting "last player still connected"
   * needs post-game socket presence tracking, a network-layer concern out
   * of scope for this pure engine. The achievement stays in the catalog
   * (07_META_GAME.md §4) but is not yet reachable; wiring it up is a
   * documented follow-up, not a silently broken feature.
   */
  wasLastConnectedAfterGame: boolean;
}

/**
 * Cumulative, cross-game stats the engine both reads and updates. Persisted
 * as a single JSON blob per user (career_stats on public.users) — a plain
 * data record, not something that needs its own relational schema.
 */
export interface CareerStats {
  gamesPlayed: number;
  gamesWon: number;
  currentWinStreak: number;
  bestWinStreak: number;
  currentKuhhandelWinStreak: number;
  bestKuhhandelWinStreak: number;
  distinctFamiliesCompletedEver: string[];
  totalBluffs: number;
  totalSuccessfulBluffs: number;
  currentSuccessfulBluffStreak: number;
  bestSuccessfulBluffStreak: number;
  unlockedBadgeKeys: string[];
  unlockedAchievementKeys: string[];
  unlockedTitleKeys: string[];
  xp: number;
  level: number;
  isFirstGameEver: boolean;
}

export function createInitialCareerStats(): CareerStats {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    currentKuhhandelWinStreak: 0,
    bestKuhhandelWinStreak: 0,
    distinctFamiliesCompletedEver: [],
    totalBluffs: 0,
    totalSuccessfulBluffs: 0,
    currentSuccessfulBluffStreak: 0,
    bestSuccessfulBluffStreak: 0,
    unlockedBadgeKeys: [],
    unlockedAchievementKeys: [],
    unlockedTitleKeys: [],
    xp: 0,
    level: 1,
    isFirstGameEver: true,
  };
}
