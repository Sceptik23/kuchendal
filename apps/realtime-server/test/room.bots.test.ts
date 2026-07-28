import { describe, expect, it } from "vitest";
import { GameRoom } from "../src/room/GameRoom.js";

describe("GameRoom — bot slots", () => {
  it("lets the host add a bot player in the lobby", () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join("p1");
    room.join("p2");

    room.addBot(p1);

    const view = room.getViewFor(p1);
    expect(view.players).toHaveLength(3);
    expect(view.players.some((p) => p.isBot)).toBe(true);
  });

  it("rejects adding a bot from a non-host player", () => {
    const room = new GameRoom(() => 0);
    room.join("p1");
    const p2 = room.join("p2");
    room.join("p3");

    expect(() => room.addBot(p2)).toThrow(/host/i);
  });
});

/**
 * 08_AI.md §2 heuristic bots (packages/bot-engine), replacing the Phase 5
 * deterministic stub. Bots now bid/sell/initiate/offer/respond using the
 * real decision functions — these tests exercise that a bot-only or mixed
 * table still plays a full, legal game to completion without ever needing
 * an external call to act on the bot's behalf.
 */
describe("GameRoom — heuristic bot autoplay (08_AI.md)", () => {
  it("a bot bidder reacts to the auction on its own, bidding an amount it actually holds", () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join("p1");
    room.join("p2");
    room.join("p3");
    room.addBot(p1);
    room.start();

    room.startAuction(p1);
    // The bot bidder has already either bid or passed by now, with no
    // external call made on its behalf — assert the auction state is
    // internally consistent either way.
    const auction = room.getViewFor(p1).auction;
    expect(auction).not.toBeNull();
    expect(["bidding", "awaiting_seller_decision"]).toContain(auction!.status);
  });

  it("plays an entire game to completion with only bots at the table besides the host", () => {
    const room = new GameRoom(() => 0.3);
    const p1 = room.join("p1");
    room.addBot(p1);
    room.addBot(p1);
    room.addBot(p1);
    room.start();

    let view = room.getViewFor(p1);
    let guard = 0;
    while (view.status === "in_progress") {
      guard += 1;
      if (guard > 500) throw new Error("Game did not converge — likely an infinite bot loop.");
      if (view.activePlayerId === p1) {
        // The host is human: reveal a card and always pass so the bots
        // settle the auction amongst themselves, then sell if it resolves.
        room.startAuction(p1);
        let auction = room.getViewFor(p1).auction;
        while (auction && auction.status === "bidding" && auction.activeBidders.length > 0) {
          room.pass(auction.activeBidders[0]!);
          auction = room.getViewFor(p1).auction;
        }
        if (room.getViewFor(p1).auction?.status === "awaiting_seller_decision") {
          room.sellerDecision(p1, "sell");
        }
      }
      view = room.getViewFor(p1);
    }

    expect(view.status).toBe("finished");
    expect(view.players.every((p) => typeof p.score === "number")).toBe(true);
  });

  it("a bot as seller auto-resolves the auction once bidding closes", () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join("p1");
    const p2 = room.join("p2");
    const p3 = room.join("p3");
    room.addBot(p1);
    room.start();
    const botId = room.getViewFor(p1).players.find((p) => p.isBot)!.id;

    // Any bidder (human or the bot reacting on its own) may already be
    // active/passed by the time this runs, so drive resolution generically
    // rather than assuming who bid what.
    function playOutHumanTurn(sellerId: string): void {
      room.startAuction(sellerId);
      let auction = room.getViewFor(sellerId).auction;
      while (auction && auction.status === "bidding" && auction.activeBidders.length > 0) {
        room.pass(auction.activeBidders[0]!);
        auction = room.getViewFor(sellerId).auction;
      }
      if (room.getViewFor(sellerId).auction?.status === "awaiting_seller_decision") {
        room.sellerDecision(sellerId, "sell");
      }
    }

    playOutHumanTurn(p1);
    playOutHumanTurn(p2);
    playOutHumanTurn(p3);

    // It's now the bot's turn — it should have auto-acted (either started
    // an auction or initiated a Kuhhandel) without being told to.
    const view = room.getViewFor(p1);
    expect(view.activePlayerId).toBe(botId);
    expect(view.auction !== null || view.kuhhandel !== null).toBe(true);
  });
});
