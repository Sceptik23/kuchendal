import { describe, expect, it, vi } from "vitest";
import { GameRoom } from "../src/room/GameRoom.js";
import type { GamePersistenceAdapter } from "../src/persistence/types.js";

function fakeAdapter(): GamePersistenceAdapter & {
  createGame: ReturnType<typeof vi.fn>;
  addPlayer: ReturnType<typeof vi.fn>;
  logEvent: ReturnType<typeof vi.fn>;
  finishGame: ReturnType<typeof vi.fn>;
  saveSnapshot: ReturnType<typeof vi.fn>;
  loadCareerStats: ReturnType<typeof vi.fn>;
  saveCareerProgress: ReturnType<typeof vi.fn>;
} {
  return {
    createGame: vi.fn().mockResolvedValue("game-123"),
    addPlayer: vi.fn().mockResolvedValue(undefined),
    logEvent: vi.fn().mockResolvedValue(undefined),
    finishGame: vi.fn().mockResolvedValue(undefined),
    saveSnapshot: vi.fn().mockResolvedValue(undefined),
    loadCareerStats: vi.fn().mockResolvedValue(null),
    saveCareerProgress: vi.fn().mockResolvedValue(undefined),
  };
}

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("GameRoom — persistence side channel", () => {
  it("creates the game and registers every player once the game starts", async () => {
    const persistence = fakeAdapter();
    const room = new GameRoom(() => 0, undefined, persistence);
    const p1 = room.join("p1", "user-1");
    room.join("p2", "user-2");
    room.join("p3", null); // guest, not authenticated
    room.start();

    await flushMicrotasks();

    expect(persistence.createGame).toHaveBeenCalledWith("user-1", expect.any(Object));
    expect(persistence.addPlayer).toHaveBeenCalledWith("game-123", "user-1", false);
    expect(persistence.addPlayer).toHaveBeenCalledWith("game-123", "user-2", false);
    expect(persistence.addPlayer).toHaveBeenCalledWith("game-123", null, false);
    void p1;
  });

  it("logs a resolved auction as a game event", async () => {
    const persistence = fakeAdapter();
    const room = new GameRoom(() => 0, undefined, persistence);
    const p1 = room.join("p1", "user-1");
    const p2 = room.join("p2", "user-2");
    const p3 = room.join("p3", "user-3");
    room.start();
    await flushMicrotasks();

    room.startAuction(p1);
    room.placeBid(p2, 10);
    room.pass(p3);
    room.sellerDecision(p1, "sell");
    await flushMicrotasks();

    expect(persistence.logEvent).toHaveBeenCalledWith(
      "game-123",
      "AUCTION_RESOLVED",
      expect.objectContaining({ cardGoesTo: p2 }),
    );
  });

  it("saves a snapshot once a turn advances to the next player", async () => {
    const persistence = fakeAdapter();
    const room = new GameRoom(() => 0, undefined, persistence);
    const p1 = room.join("p1", "user-1");
    const p2 = room.join("p2", "user-2");
    const p3 = room.join("p3", "user-3");
    room.start();
    await flushMicrotasks();

    room.startAuction(p1);
    room.placeBid(p2, 10);
    room.pass(p3);
    room.sellerDecision(p1, "sell");
    await flushMicrotasks();

    expect(persistence.saveSnapshot).toHaveBeenCalledWith(
      "game-123",
      1,
      expect.objectContaining({ activePlayerIndex: 1 }),
    );
  });

  it("finishes the game with final scores and ranks once the deck is exhausted", async () => {
    const persistence = fakeAdapter();
    const deepBankroll = () =>
      Array.from({ length: 20 }, (_, i) => ({ id: `deep-${i}-${Math.random()}`, value: 10 as const }));
    const room = new GameRoom(() => 0, deepBankroll, persistence);
    const p1 = room.join("p1", "user-1");
    room.join("p2", "user-2");
    room.join("p3", "user-3");
    room.start();
    await flushMicrotasks();

    let view = room.getViewFor(p1);
    while (view.status === "in_progress") {
      const activeId = view.activePlayerId!;
      const others = view.players.map((p) => p.id).filter((id) => id !== activeId);
      room.startAuction(activeId);
      room.placeBid(others[0]!, 10);
      room.pass(others[1]!);
      room.sellerDecision(activeId, "sell");
      view = room.getViewFor(p1);
    }
    await flushMicrotasks();

    expect(persistence.finishGame).toHaveBeenCalledTimes(1);
    const [gameId, results] = persistence.finishGame.mock.calls[0]!;
    expect(gameId).toBe("game-123");
    expect(results).toHaveLength(3);
    const ranks = results.map((r: { rank: number }) => r.rank).sort();
    expect(ranks).toEqual([1, 2, 3]);
  });
});
