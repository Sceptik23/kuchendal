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
}
