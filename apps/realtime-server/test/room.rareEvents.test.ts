import { describe, expect, it } from "vitest";
import { RARE_EVENTS } from "@kuhhandel/rare-events-engine";
import { GameRoom } from "../src/room/GameRoom.js";
import { moneyCardIdsFor } from "./helpers/playToGameOver.js";

describe("GameRoom — rare events (07_META_GAME.md §6)", () => {
  it("surfaces a rare event on the feed after a turn ends, without touching scores", () => {
    // rng() === 0 always clears both the per-turn gate and the weighted
    // pick, so a rare event fires deterministically every turn.
    const room = new GameRoom(() => 0);
    const p1 = room.join("p1");
    const p2 = room.join("p2");
    const p3 = room.join("p3");
    room.start();

    room.startAuction(p1);
    room.placeBid(p2, moneyCardIdsFor(room, p2, 10));
    room.pass(p3);
    room.sellerDecision(p1, "sell");

    const view = room.getViewFor(p1);
    expect(view.rareEventsFeed.length).toBeGreaterThan(0);
    expect(RARE_EVENTS).toContainEqual(view.rareEventsFeed[0]);
    // Cosmetic only: nobody's score should reflect the rare event itself.
    expect(view.players.every((p) => p.score === null)).toBe(true);
  });

  it("never surfaces a rare event when the rng never clears the per-turn gate", () => {
    const room = new GameRoom(() => 0.99);
    const p1 = room.join("p1");
    const p2 = room.join("p2");
    const p3 = room.join("p3");
    room.start();

    room.startAuction(p1);
    room.placeBid(p2, moneyCardIdsFor(room, p2, 10));
    room.pass(p3);
    room.sellerDecision(p1, "sell");

    expect(room.getViewFor(p1).rareEventsFeed).toHaveLength(0);
  });
});
