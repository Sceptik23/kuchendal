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
}

export class NullPersistenceAdapter implements GamePersistenceAdapter {
  async createGame(): Promise<string> {
    return "";
  }
  async addPlayer(): Promise<void> {}
  async logEvent(): Promise<void> {}
  async finishGame(): Promise<void> {}
}
