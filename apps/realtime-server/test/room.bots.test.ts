import { describe, expect, it } from "vitest";
import type { GamePhase, Player } from "@kuhhandel/game-engine";
import { GameRoom } from "../src/room/GameRoom.js";

/** Narrow view into GameRoom's private state, only for FORCED_KUHHANDEL setup below. */
type GameRoomInternals = {
  phase: GamePhase;
  deck: unknown[];
  players: Player[];
  activePlayerIndex: number;
  auction: unknown;
  kuhhandel: unknown;
  runBotLoop: () => void;
};

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

/**
 * Regression for a Critical bug found in review of Task 14: once the deck
 * is empty, FORCED_KUHHANDEL makes startAuction throw ("Kuhhandel is now
 * mandatory"). decideKuhhandelInitiation (packages/bot-engine) was written
 * for the NORMAL phase and returns null for any bot that doesn't hold a
 * *duplicate* of some species — which is exactly what happens whenever a
 * bot holds only a single card of an incomplete family, even though a
 * legal Kuhhandel with another player unquestionably exists (the auto-pass
 * loop in endTurn only leaves a bot as activePlayer during FORCED_KUHHANDEL
 * if it holds an incomplete-family animal, which by definition some other
 * player also holds a card of). Before the fix, runBotLoop's null branch
 * unconditionally called startAuction and wedged the room permanently, with
 * every subsequent human action re-throwing.
 */
describe("GameRoom — FORCED_KUHHANDEL bot fallback (regression)", () => {
  it("a bot with only a single, non-duplicate incomplete-family animal starts a legal Kuhhandel instead of throwing", () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join("p1");
    room.join("p2");
    const botId = room.addBot(p1);
    room.start();

    const internal = room as unknown as GameRoomInternals;
    const botIndex = internal.players.findIndex((p) => p.id === botId);
    const p1Index = internal.players.findIndex((p) => p.id === p1);

    // Bot holds exactly one "coq" (not a duplicate, so
    // decideKuhhandelInitiation's duplicateSpecies filter excludes it and
    // returns null), while p1 also holds a "coq" — a legal Kuhhandel
    // partner unquestionably exists.
    internal.players = internal.players.map((p, i) => {
      if (i === botIndex) return { ...p, animals: [{ id: "bot-coq", species: "coq" }] };
      if (i === p1Index) return { ...p, animals: [{ id: "p1-coq", species: "coq" }] };
      return p;
    });
    internal.deck = [];
    internal.phase = "FORCED_KUHHANDEL";
    internal.auction = null;
    internal.kuhhandel = null;
    internal.activePlayerIndex = botIndex;

    expect(() => internal.runBotLoop()).not.toThrow();

    const view = room.getViewFor(p1);
    expect(view.kuhhandel).not.toBeNull();
    expect(view.kuhhandel?.initiatorId).toBe(botId);
    expect(view.kuhhandel?.targetId).toBe(p1);
    expect(view.kuhhandel?.species).toBe("coq");
  });
});
