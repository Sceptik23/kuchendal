import { describe, expect, it } from "vitest";
import { GameRoom } from "../src/room/GameRoom.js";

describe("GameRoom — host identity", () => {
  it("makes the first joiner the host", () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join("p1");
    room.join("p2");

    expect(room.getViewFor(p1).hostPlayerId).toBe(p1);
  });
});

describe("GameRoom — kicking a player", () => {
  it("lets the host remove a player while still in the lobby", () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join("p1");
    const p2 = room.join("p2");
    room.join("p3");

    room.kickPlayer(p1, p2);

    const view = room.getViewFor(p1);
    expect(view.players.map((p) => p.id)).not.toContain(p2);
  });

  it("rejects a kick from a non-host player", () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join("p1");
    const p2 = room.join("p2");
    room.join("p3");

    expect(() => room.kickPlayer(p2, p1)).toThrow(/host/i);
  });

  it("rejects kicking once the game has started", () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join("p1");
    const p2 = room.join("p2");
    room.join("p3");
    room.start();

    expect(() => room.kickPlayer(p1, p2)).toThrow(/lobby|started/i);
  });
});

describe("GameRoom — transferring host", () => {
  it("lets the host hand the role to another player", () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join("p1");
    const p2 = room.join("p2");
    room.join("p3");

    room.transferHost(p1, p2);

    expect(room.getViewFor(p1).hostPlayerId).toBe(p2);
  });

  it("rejects a transfer requested by a non-host", () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join("p1");
    const p2 = room.join("p2");
    room.join("p3");

    expect(() => room.transferHost(p2, p1)).toThrow(/host/i);
  });
});
