import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GamePersistenceAdapter } from "./types.js";

/**
 * Uses the service_role key — bypasses RLS by design, since this adapter
 * runs only inside the trusted realtime-server, never in a browser
 * (03_ARCHITECTURE.md §7). Never import this module from apps/web.
 */
export class SupabasePersistenceAdapter implements GamePersistenceAdapter {
  private readonly client: SupabaseClient;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async createGame(hostUserId: string | null, rulesetConfig: unknown): Promise<string> {
    const { data, error } = await this.client
      .from("games")
      .insert({
        status: "in_progress",
        ruleset_config: rulesetConfig,
        started_at: new Date().toISOString(),
        host_user_id: hostUserId,
      })
      .select("id")
      .single();

    if (error) throw error;
    return data.id as string;
  }

  async addPlayer(gameId: string, userId: string | null, isBot: boolean): Promise<void> {
    if (!userId) return; // guests without an account aren't persisted as game_players rows
    const { error } = await this.client
      .from("game_players")
      .insert({ game_id: gameId, user_id: userId, is_bot: isBot });
    if (error) throw error;
  }

  async logEvent(gameId: string, eventType: string, payload: unknown): Promise<void> {
    const { error } = await this.client
      .from("game_events_log")
      .insert({ game_id: gameId, event_type: eventType, payload: payload as object });
    if (error) throw error;
  }

  async finishGame(
    gameId: string,
    results: { userId: string | null; score: number; rank: number }[],
  ): Promise<void> {
    const { error: gameError } = await this.client
      .from("games")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("id", gameId);
    if (gameError) throw gameError;

    for (const result of results) {
      if (!result.userId) continue;
      const { error } = await this.client
        .from("game_players")
        .update({ final_score: result.score, final_rank: result.rank })
        .eq("game_id", gameId)
        .eq("user_id", result.userId);
      if (error) throw error;
    }
  }

  async saveSnapshot(gameId: string, turnNumber: number, state: unknown): Promise<void> {
    const { error } = await this.client
      .from("game_snapshots")
      .insert({ game_id: gameId, turn_number: turnNumber, state_jsonb: state as object });
    if (error) throw error;
  }

  async loadCareerStats(userId: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("users")
      .select("career_stats")
      .eq("id", userId)
      .single();
    if (error) throw error;
    const stats = data.career_stats as Record<string, unknown>;
    return stats && Object.keys(stats).length > 0 ? stats : null;
  }

  private async unlockByKeys(
    catalogTable: "badges" | "achievements" | "titles",
    junctionTable: "user_badges" | "user_achievements" | "user_titles",
    junctionKeyColumn: "badge_id" | "achievement_id" | "title_id",
    userId: string,
    keys: string[],
  ): Promise<void> {
    if (keys.length === 0) return;
    const { data: rows, error: lookupError } = await this.client
      .from(catalogTable)
      .select("id, key")
      .in("key", keys);
    if (lookupError) throw lookupError;

    const inserts = (rows ?? []).map((row: { id: string }) => ({
      user_id: userId,
      [junctionKeyColumn]: row.id,
    }));
    if (inserts.length === 0) return;

    const { error } = await this.client
      .from(junctionTable)
      .upsert(inserts, { onConflict: `user_id,${junctionKeyColumn}`, ignoreDuplicates: true });
    if (error) throw error;
  }

  async saveCareerProgress(
    userId: string,
    stats: unknown,
    newlyUnlockedBadgeKeys: string[],
    newlyUnlockedAchievementKeys: string[],
    newlyUnlockedTitleKeys: string[],
  ): Promise<void> {
    const s = stats as { xp: number; level: number };
    const { error } = await this.client
      .from("users")
      .update({ career_stats: stats as object, xp: s.xp, level: s.level })
      .eq("id", userId);
    if (error) throw error;

    await this.unlockByKeys("badges", "user_badges", "badge_id", userId, newlyUnlockedBadgeKeys);
    await this.unlockByKeys(
      "achievements",
      "user_achievements",
      "achievement_id",
      userId,
      newlyUnlockedAchievementKeys,
    );
    await this.unlockByKeys("titles", "user_titles", "title_id", userId, newlyUnlockedTitleKeys);
  }
}
