import { describe, expect, it, vi } from "vitest";

vi.mock("@kuhhandel/bot-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@kuhhandel/bot-engine")>();
  return {
    ...actual,
    decideAuctionBid: () => {
      throw new Error("boom: simulated bot decision failure");
    },
  };
});

const { GameRoom } = await import("../src/room/GameRoom.js");

/**
 * Regression test for a real freeze reported in production: a bot bidder
 * whose decision throws used to abort the whole synchronous runBotLoop
 * cascade uncaught, leaving the auction stuck in 'bidding' forever (no
 * player — not even the seller — had any action available), and the
 * exception's partial state mutation was never broadcast to any client.
 */
describe("GameRoom — bot auction-bidding resilience", () => {
  it("falls back to a pass instead of freezing the auction when a bot's bid decision throws", () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join("p1");
    room.addBot(p1); // bot bidder — its decideAuctionBid is mocked to throw
    const p3 = room.join("p3");
    room.start();

    expect(() => room.startAuction(p1)).not.toThrow();

    const view = room.getViewFor(p1);
    // The bot must have been removed from activeBidders via the safe
    // fallback pass, not left dangling in a permanently 'bidding' auction.
    const botId = view.players.find((p) => p.isBot)!.id;
    expect(view.auction?.activeBidders).not.toContain(botId);

    // p3 (the only other active bidder) can still legitimately act —
    // proof the room isn't wedged.
    expect(() => room.pass(p3)).not.toThrow();
    expect(room.getViewFor(p1).auction?.status).toBe("awaiting_seller_decision");
  });
});
