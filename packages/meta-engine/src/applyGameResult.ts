import { BADGES } from "./config/badges.config.js";
import { ACHIEVEMENTS } from "./config/achievements.config.js";
import { TITLES } from "./config/titles.config.js";
import { BADGE_RARITY_XP, XP_SOURCES } from "./config/xp.config.js";
import { updateCareerStats } from "./careerStats.js";
import { levelForXp } from "./xp.js";
import { evaluateUnlocks, type EvaluationContext } from "./unlocks.js";
import type { CareerStats, GameSummary } from "./types.js";

export interface GameResultOutcome {
  nextStats: CareerStats;
  xpGained: number;
  newlyUnlockedBadgeKeys: string[];
  newlyUnlockedAchievementKeys: string[];
  newlyUnlockedTitleKeys: string[];
  leveledUp: boolean;
}

const ALL_BADGE_KEYS = BADGES.map((b) => b.key);

/**
 * Single entry point the realtime-server calls once per finished game per
 * player. Pure and side-effect free — persisting the result is the
 * caller's job (GamePersistenceAdapter), not this engine's.
 */
export function applyGameResult(prevStats: CareerStats, summary: GameSummary): GameResultOutcome {
  const isFirstVictoryEver = summary.won && prevStats.gamesWon === 0;
  const isFirstKuhhandelEver = summary.kuhhandelsWonThisGame > 0 && prevStats.bestKuhhandelWinStreak === 0 && prevStats.currentKuhhandelWinStreak === 0;
  const isFirstBluffEver = summary.totalBluffsThisGame > 0 && prevStats.totalBluffs === 0;

  const statsAfterGame = updateCareerStats(prevStats, summary);

  let xp = XP_SOURCES.PARTICIPATION;
  if (summary.won) xp += XP_SOURCES.VICTORY;
  if (isFirstVictoryEver) xp += XP_SOURCES.FIRST_VICTORY_EVER;
  if (isFirstKuhhandelEver) xp += XP_SOURCES.FIRST_KUHHANDEL_EVER;
  if (isFirstBluffEver) xp += XP_SOURCES.FIRST_BLUFF_EVER;
  if (statsAfterGame.currentWinStreak >= 2) {
    xp += statsAfterGame.currentWinStreak * XP_SOURCES.WIN_STREAK_BONUS_PER_STREAK_WIN;
  }
  xp += summary.familiesCompletedThisGame.length * XP_SOURCES.FAMILY_COMPLETED;

  const xpBeforeUnlocks = prevStats.xp + xp;

  const ctx: EvaluationContext = {
    stats: { ...statsAfterGame, xp: xpBeforeUnlocks, level: levelForXp(xpBeforeUnlocks) },
    summary,
    catalogBadgeKeys: ALL_BADGE_KEYS.filter((k) => k !== "legende_du_village"),
  };

  const newlyUnlockedBadgeKeys = evaluateUnlocks(BADGES, ctx, prevStats.unlockedBadgeKeys);
  for (const key of newlyUnlockedBadgeKeys) {
    const badge = BADGES.find((b) => b.key === key)!;
    xp += BADGE_RARITY_XP[badge.rarity];
  }

  // Re-check "all badges unlocked" now that this game's badges are in.
  const statsAfterBadges = {
    ...ctx.stats,
    unlockedBadgeKeys: [...prevStats.unlockedBadgeKeys, ...newlyUnlockedBadgeKeys],
  };
  const legendaryUnlock = evaluateUnlocks(
    BADGES.filter((b) => b.key === "legende_du_village"),
    { ...ctx, stats: statsAfterBadges },
    statsAfterBadges.unlockedBadgeKeys,
  );
  for (const key of legendaryUnlock) {
    const badge = BADGES.find((b) => b.key === key)!;
    xp += BADGE_RARITY_XP[badge.rarity];
  }
  newlyUnlockedBadgeKeys.push(...legendaryUnlock);

  const newlyUnlockedAchievementKeys = evaluateUnlocks(
    ACHIEVEMENTS,
    ctx,
    prevStats.unlockedAchievementKeys,
  );
  xp += newlyUnlockedAchievementKeys.length * XP_SOURCES.ACHIEVEMENT_UNLOCKED;

  const finalXp = prevStats.xp + xp;
  const finalLevel = levelForXp(finalXp);

  const newlyUnlockedTitleKeys = evaluateUnlocks(
    TITLES,
    { ...ctx, stats: { ...ctx.stats, xp: finalXp, level: finalLevel } },
    prevStats.unlockedTitleKeys,
  );

  const nextStats: CareerStats = {
    ...statsAfterGame,
    xp: finalXp,
    level: finalLevel,
    unlockedBadgeKeys: [...prevStats.unlockedBadgeKeys, ...newlyUnlockedBadgeKeys],
    unlockedAchievementKeys: [...prevStats.unlockedAchievementKeys, ...newlyUnlockedAchievementKeys],
    unlockedTitleKeys: [...prevStats.unlockedTitleKeys, ...newlyUnlockedTitleKeys],
  };

  return {
    nextStats,
    xpGained: xp,
    newlyUnlockedBadgeKeys,
    newlyUnlockedAchievementKeys,
    newlyUnlockedTitleKeys,
    leveledUp: finalLevel > prevStats.level,
  };
}
