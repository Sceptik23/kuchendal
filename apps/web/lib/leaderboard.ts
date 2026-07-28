import { supabase } from "./supabaseClient";

export type LeaderboardCategory = "xp" | "wins" | "bluffs" | "badges";
export type LeaderboardScope = "global" | "friends";

export interface LeaderboardEntry {
  userId: string;
  username: string;
  value: number;
}

interface CareerStatsShape {
  gamesWon?: number;
  totalSuccessfulBluffs?: number;
  unlockedBadgeKeys?: string[];
}

interface UserRow {
  id: string;
  username: string;
  xp: number;
  career_stats: CareerStatsShape | null;
}

function extractValue(row: UserRow, category: LeaderboardCategory): number {
  switch (category) {
    case "xp":
      return row.xp;
    case "wins":
      return row.career_stats?.gamesWon ?? 0;
    case "bluffs":
      return row.career_stats?.totalSuccessfulBluffs ?? 0;
    case "badges":
      return row.career_stats?.unlockedBadgeKeys?.length ?? 0;
  }
}

/**
 * v1 simplification (02_PRD_PRODUCT.md §8, 04_DATABASE.md §2 "leaderboards"):
 * only "xp" sorts natively in SQL. The other categories live inside the
 * `career_stats` jsonb blob, so we rank within a bounded top-XP pool
 * client-side instead of standing up a materialized view + periodic
 * recompute job — that's an explicitly post-v1 extension per the docs
 * (weekly/monthly/historical scopes), not a blocker for a first working
 * "mondial + amis" leaderboard.
 */
const GLOBAL_LEADERBOARD_POOL_SIZE = 200;

export async function loadLeaderboard(
  category: LeaderboardCategory,
  scope: LeaderboardScope,
  myUserId: string,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  let friendIds: string[] | null = null;
  if (scope === "friends") {
    const { data: friendRows, error: friendError } = await supabase
      .from("friendships")
      .select("user_a_id, user_b_id")
      .eq("status", "accepted")
      .or(`user_a_id.eq.${myUserId},user_b_id.eq.${myUserId}`);
    if (friendError) throw friendError;
    friendIds = (friendRows ?? []).map((r) => (r.user_a_id === myUserId ? r.user_b_id : r.user_a_id));
    friendIds.push(myUserId);
  }

  let query = supabase
    .from("users")
    .select("id, username, xp, career_stats")
    .order("xp", { ascending: false })
    .limit(GLOBAL_LEADERBOARD_POOL_SIZE);
  if (friendIds) query = query.in("id", friendIds);

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as UserRow[])
    .map((row) => ({ userId: row.id, username: row.username, value: extractValue(row, category) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}
