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

describe("GameRoom — bot autoplay stub (08_AI.md deferred, minimal stub for now)", () => {
  it("a bot bidder auto-passes without any external call", () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join("p1");
    const p2 = room.join("p2");
    room.join("p3");
    room.addBot(p1);
    room.start();

    room.startAuction(p1);
    room.placeBid(p2, 10);
    // No call to pass() for the bot or p3 pausing here — the bot should
    // already have auto-passed the instant the auction opened.
    room.pass(room.getViewFor(p1).players.find((p) => !p.isBot && p.id !== p1 && p.id !== p2)!.id);

    // Bidding is down to just p2's bid with everyone else out — resolvable.
    expect(room.getViewFor(p1).auction?.status).toBe("awaiting_seller_decision");
  });

  it("a bot as the active player automatically starts and resolves its own turn", () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join("p1");
    const p2 = room.join("p2");
    const p3 = room.join("p3");
    room.addBot(p1);
    room.start();
    const botId = room.getViewFor(p1).players.find((p) => p.isBot)!.id;

    // Cycle through the three humans' turns to reach the bot's turn. The
    // bot auto-passes as a bidder on each of these without any call here.
    room.startAuction(p1);
    room.placeBid(p2, 10);
    room.pass(p3);
    room.sellerDecision(p1, "sell");

    room.startAuction(p2);
    room.placeBid(p1, 10);
    room.pass(p3);
    room.sellerDecision(p2, "sell");

    room.startAuction(p3);
    room.placeBid(p1, 10);
    room.pass(p2);
    room.sellerDecision(p3, "sell");

    // It's now the bot's turn — it should have auto-revealed a card and,
    // since every other bidder passed except p1/p2/p3 already acted in
    // prior turns, this fresh auction has no bot bidders left to act, so it
    // resolves as soon as the (human) bidders respond. Since nobody has
    // bid yet on the bot's card, verify the bot's turn is indeed active
    // before any human acts, proving it auto-started without being told to.
    const view = room.getViewFor(p1);
    expect(view.activePlayerId).toBe(botId);
    expect(view.auction).not.toBeNull();
    expect(view.auction!.sellerId).toBe(botId);
  });
});
