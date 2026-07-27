/**
 * Side-channel for persisting game history (04_DATABASE.md). Deliberately
 * decoupled from GameRoom's synchronous rule flow: calls are fire-and-forget
 * from the caller's perspective (errors are caught and logged, never thrown
 * back into gameplay) so that a slow or failing database never blocks or
 * corrupts an in-progress game — the server-authoritative rules engine
 * (packages/game-engine + GameRoom) stays the source of truth regardless of
 * persistence outcome.
 */
export interface GamePersistenceAdapter {
  createGame(hostUserId: string | null, rulesetConfig: unknown): Promise<string>;
  addPlayer(gameId: string, userId: string | null, isBot: boolean): Promise<void>;
  logEvent(gameId: string, eventType: string, payload: unknown): Promise<void>;
  finishGame(
    gameId: string,
    results: { userId: string | null; score: number; rank: number }[],
  ): Promise<void>;
  /**
   * Persists a full serialized snapshot of the engine state after a turn
   * (03_ARCHITECTURE.md §6). Scope note: Phase 5 saves snapshots for
   * history/audit and as groundwork for a future "resume" feature — it does
   * not yet reconstruct a live GameRoom from a saved snapshot (rebuilding
   * the in-progress auction/Kuhhandel sub-state machines faithfully is
   * substantial enough to warrant its own follow-up phase rather than a
   * rushed reconstruction here).
   */
  saveSnapshot(gameId: string, turnNumber: number, state: unknown): Promise<void>;
}

export class NullPersistenceAdapter implements GamePersistenceAdapter {
  async createGame(): Promise<string> {
    return "";
  }
  async addPlayer(): Promise<void> {}
  async logEvent(): Promise<void> {}
  async finishGame(): Promise<void> {}
  async saveSnapshot(): Promise<void> {}
}
