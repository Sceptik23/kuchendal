import type { Rarity } from "../types.js";

/**
 * 07_META_GAME.md §2: xp_requis(n) = 100 * n^1.4 — the XP cost to advance
 * from level n to level n+1. Adjustable in playtest without touching the
 * engine.
 */
export function xpCostForLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.4));
}

export const XP_SOURCES = {
  PARTICIPATION: 20,
  VICTORY: 50,
  FIRST_VICTORY_EVER: 100,
  FIRST_KUHHANDEL_EVER: 50,
  FIRST_BLUFF_EVER: 50,
  WIN_STREAK_BONUS_PER_STREAK_WIN: 20,
  FAMILY_COMPLETED: 40,
  ACHIEVEMENT_UNLOCKED: 80,
} as const;

export const BADGE_RARITY_XP: Record<Rarity, number> = {
  commun: 20,
  rare: 50,
  epique: 100,
  legendaire: 200,
  secret: 300,
  mythique: 400,
  ultra_secret: 500,
};
