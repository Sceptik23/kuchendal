import { describe, expect, it, vi } from "vitest";
import { GameRoom } from "../src/room/GameRoom.js";
import type { GamePersistenceAdapter } from "../src/persistence/types.js";

function fakeAdapter(): GamePersistenceAdapter & {
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
    saveHallOfFameShameEntries: vi.fn().mockResolvedValue(undefined),
  };
}

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("GameRoom — awards meta-progression to real accounts at game end", () => {
  it("calls saveCareerProgress once per player with a real userId, skipping guests", async () => {
    const persistence = fakeAdapter();
    const deepBankroll = () =>
      Array.from({ length: 20 }, (_, i) => ({ id: `deep-${i}-${Math.random()}`, value: 10 as const }));
    const room = new GameRoom(() => 0, deepBankroll, persistence);
    const p1 = room.join("p1", "user-1");
    room.join("p2", "user-2");
    room.join("p3", null); // guest, no account

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

    expect(persistence.saveCareerProgress).toHaveBeenCalledTimes(2);
    const calledUserIds = persistence.saveCareerProgress.mock.calls.map((c) => c[0]);
    expect(calledUserIds.sort()).toEqual(["user-1", "user-2"]);

    const [, stats, newBadges] = persistence.saveCareerProgress.mock.calls[0]!;
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.xp).toBeGreaterThan(0);
    expect(Array.isArray(newBadges)).toBe(true);
  });
});
