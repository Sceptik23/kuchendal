import { describe, expect, it } from "vitest";
import type { AuctionState, MoneyCard, Player } from "@kuhhandel/game-engine";
import { startAuction, startKuhhandel, submitInitiatorOffer } from "@kuhhandel/game-engine";
import { BOT_DIFFICULTY_PRESETS } from "../src/config.js";
import {
  decideAuctionBid,
  decideKuhhandelInitiation,
  decideKuhhandelOffer,
  decideKuhhandelResponse,
  decideSellerDecision,
} from "../src/decisions.js";
import { selectCardsForAmount, selectCardsExceeding, selectExactCards, totalValue } from "../src/money.js";

const rng = () => 0.5; // deterministic mid-point: no jitter push in either direction

function money(...values: MoneyCard["value"][]): MoneyCard[] {
  return values.map((value, i) => ({ id: `m${i}-${value}`, value }));
}

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: "bot-1",
    name: "Bot 1",
    money: money(10, 50, 100, 200, 500),
    animals: [],
    ...overrides,
  };
}

describe("money.selectCardsForAmount", () => {
  it("picks the largest cards that fit under the target without exceeding it", () => {
    const hand = money(10, 50, 100, 200, 500);
    const picked = selectCardsForAmount(hand, 260);
    expect(totalValue(picked)).toBeLessThanOrEqual(260);
    expect(picked.map((c) => c.value)).toEqual([200, 50, 10]);
  });

  it("never returns an empty selection when the hand has any non-zero card", () => {
    const hand = money(0, 0, 500);
    const picked = selectCardsForAmount(hand, 1);
    expect(picked).toHaveLength(1);
    expect(picked[0]!.value).toBe(500);
  });
});

describe("money.selectCardsExceeding", () => {
  it("returns null when no affordable raise exists", () => {
    expect(selectCardsExceeding(money(10), 500, 500)).toBeNull();
  });

  it("composes the largest sum within budget when it exceeds the minimum", () => {
    const hand = money(10, 50, 100);
    const result = selectCardsExceeding(hand, 40, 200);
    expect(result).not.toBeNull();
    const sum = result!.reduce((s, c) => s + c.value, 0);
    expect(sum).toBeGreaterThan(40);
    expect(sum).toBeLessThanOrEqual(200);
  });

  it("returns null when the best affordable sum still doesn't exceed the minimum", () => {
    const hand = money(10, 10);
    expect(selectCardsExceeding(hand, 50, 100)).toBeNull();
  });

  it("finds the best combination even when greedy largest-first fails (regression)", () => {
    // Greedy would take 500 first, then can't fit any 200, returning null.
    // But [200, 200, 200] = 600 is a valid raise > 550 and <= 600.
    const hand = money(500, 200, 200, 200);
    const result = selectCardsExceeding(hand, 550, 600);
    expect(result).not.toBeNull();
    const sum = result!.reduce((s, c) => s + c.value, 0);
    expect(sum).toBe(600);
  });

  it("returns null (not []) when there is no highest bid and no card fits the budget (regression)", () => {
    // minAmount = -1 (no existing highest bid, per decideAuctionBid's
    // `state.highestBid?.amount ?? -1`). The empty selection (sum 0)
    // satisfies `0 > -1`, so without the chosen.length > 0 guard this
    // would wrongly return [] — a truthy "bid nothing" result that
    // GameRoom.runBotLoop would place as a free 0-value bid.
    const hand = money(50);
    const result = selectCardsExceeding(hand, -1, 3);
    expect(result).toBeNull();
  });

  it("completes promptly and correctly for a large hand (no exponential blowup)", () => {
    const hand = money(...Array.from({ length: 28 }, (_, i) => (i % 2 === 0 ? 10 : 50)));
    const start = Date.now();
    const result = selectCardsExceeding(hand, 40, 200);
    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(2000);
    expect(result).not.toBeNull();
    const sum = result!.reduce((s, c) => s + c.value, 0);
    expect(sum).toBeGreaterThan(40);
    expect(sum).toBeLessThanOrEqual(200);
  });
});

describe("money.selectExactCards", () => {
  it("finds a single-card exact match", () => {
    const hand = money(10, 50, 100);
    const result = selectExactCards(hand, 50);
    expect(result).toEqual([hand[1]]);
  });

  it("finds a combined exact match when no single card matches", () => {
    const hand = money(10, 50, 100);
    const result = selectExactCards(hand, 60);
    expect(result).not.toBeNull();
    const sum = result!.reduce((s, c) => s + c.value, 0);
    expect(sum).toBe(60);
  });

  it("returns null when no subset sums to the exact target", () => {
    const hand = money(10, 10);
    expect(selectExactCards(hand, 25)).toBeNull();
  });

  it("returns an empty array for a target of exactly 0", () => {
    expect(selectExactCards(money(10, 50), 0)).toEqual([]);
  });
});

describe("decideAuctionBid", () => {
  it("only proposes cards the bot actually holds, summing above the current highest", () => {
    const bot = player({ animals: [{ id: "a1", species: "vache" }] });
    const state: AuctionState = startAuction({ id: "c1", species: "vache" }, "seller", [bot.id]);
    const bid = decideAuctionBid(bot, state, BOT_DIFFICULTY_PRESETS.normal, rng);
    if (bid !== null) {
      const bidIds = new Set(bid.map((c) => c.id));
      expect(bot.money.every((c) => !bidIds.has(c.id) || bot.money.some((h) => h.id === c.id))).toBe(true);
      expect(bid.reduce((sum, c) => sum + c.value, 0)).toBeGreaterThan(state.highestBid?.amount ?? -1);
    }
  });

  it("passes once every affordable combination is below its budget cap", () => {
    const bot = player({ money: money(10) });
    const state: AuctionState = {
      card: { id: "c1", species: "vache" },
      sellerId: "seller",
      activeBidders: [bot.id],
      highestBid: { playerId: "other", cards: money(500), amount: 500 },
      status: "bidding",
    };
    const bid = decideAuctionBid(bot, state, BOT_DIFFICULTY_PRESETS.easy, rng);
    expect(bid).toBeNull();
  });

  it("passes (returns null, not []) when nobody has bid yet and the budget is below the cheapest card (regression)", () => {
    // No highest bid at all (state.highestBid is null → currentHighest -1
    // inside decideAuctionBid). The bot's estimated budget for a
    // low-value species is tiny — well below its cheapest 10-value card —
    // so no real raise is affordable. Before the fix, selectCardsExceeding
    // could return [] here (truthy), which GameRoom.runBotLoop would place
    // as a free 0-value bid, winning the animal for nothing.
    const bot = player({
      money: money(10, 10, 50),
      animals: [],
    });
    const state: AuctionState = startAuction({ id: "c1", species: "coq" }, "seller", [bot.id]);
    const bid = decideAuctionBid(
      bot,
      state,
      { ...BOT_DIFFICULTY_PRESETS.easy, aggressiveness: 0.001, riskTolerance: 0 },
      rng,
    );
    expect(bid).toBeNull();
  });

  it("can combine multiple cards into a single bid when its budget allows", () => {
    const bot = player({
      money: money(10, 10, 10, 10, 10),
      animals: [
        { id: "a1", species: "vache" },
        { id: "a2", species: "vache" },
        { id: "a3", species: "vache" },
      ],
    });
    const state: AuctionState = {
      card: { id: "c1", species: "vache" },
      sellerId: "seller",
      activeBidders: [bot.id],
      highestBid: { playerId: "other", cards: money(30), amount: 30 },
      status: "bidding",
    };
    // BOT_DIFFICULTY_PRESETS only defines "easy"/"normal" (docs/08_AI.md §2);
    // force a high-aggressiveness config here to exercise multi-card combination.
    const bid = decideAuctionBid(bot, state, { ...BOT_DIFFICULTY_PRESETS.normal, aggressiveness: 0.9 }, rng);
    expect(bid).not.toBeNull();
    expect(bid!.length).toBeGreaterThan(1);
  });
});

describe("decideSellerDecision", () => {
  it("sells when the highest bid clears the estimate", () => {
    const seller = player();
    const state: AuctionState = {
      card: { id: "c1", species: "cochon" },
      sellerId: seller.id,
      activeBidders: [],
      highestBid: { playerId: "buyer", cards: money(500), amount: 500 },
      status: "awaiting_seller_decision",
    };
    expect(decideSellerDecision(seller, state, BOT_DIFFICULTY_PRESETS.normal)).toEqual({ decision: "sell" });
  });

  it("sells even a low bid it wants to reject, if it can't afford to pay the bidder to keep", () => {
    const seller = player({ money: money(10) }); // can't compose 500 to keep
    const state: AuctionState = {
      card: { id: "c1", species: "cochon" },
      sellerId: seller.id,
      activeBidders: [],
      highestBid: { playerId: "buyer", cards: money(500), amount: 500 },
      status: "awaiting_seller_decision",
    };
    expect(decideSellerDecision(seller, state, BOT_DIFFICULTY_PRESETS.easy)).toEqual({ decision: "sell" });
  });

  it("sells for free when nobody bid (no reason to keep for nothing)", () => {
    const seller = player();
    const state: AuctionState = {
      card: { id: "c1", species: "cochon" },
      sellerId: seller.id,
      activeBidders: [],
      highestBid: null,
      status: "awaiting_seller_decision",
    };
    expect(decideSellerDecision(seller, state, BOT_DIFFICULTY_PRESETS.normal)).toEqual({ decision: "sell" });
  });

  it("can keep by combining multiple cards into an exact payment", () => {
    const seller = player({ money: money(10, 10, 10) }); // only exact via 10+10+10=30
    const state: AuctionState = {
      card: { id: "c1", species: "cochon" },
      sellerId: seller.id,
      activeBidders: [],
      highestBid: { playerId: "buyer", cards: money(30), amount: 30 },
      status: "awaiting_seller_decision",
    };
    // Force "keep" to be preferable regardless of estimate via a low-aggressiveness config
    const decision = decideSellerDecision(seller, state, { ...BOT_DIFFICULTY_PRESETS.easy, aggressiveness: 100 });
    if (decision.decision === "keep") {
      expect(decision.paymentCards.reduce((sum, c) => sum + c.value, 0)).toBe(30);
    }
  });
});

describe("decideKuhhandelInitiation", () => {
  it("targets a player who shares a species the bot holds a duplicate of", () => {
    const bot = player({
      animals: [
        { id: "a1", species: "cochon" },
        { id: "a2", species: "cochon" },
      ],
    });
    const other: Player = {
      id: "p2",
      name: "P2",
      money: money(10),
      animals: [{ id: "a3", species: "cochon" }],
    };
    const decision = decideKuhhandelInitiation(bot, [other], BOT_DIFFICULTY_PRESETS.normal);
    expect(decision).toEqual({ targetId: "p2", species: "cochon" });
  });

  it("returns null when the bot has no duplicate species at all", () => {
    const bot = player({ animals: [{ id: "a1", species: "cochon" }] });
    const other: Player = {
      id: "p2",
      name: "P2",
      money: money(10),
      animals: [{ id: "a3", species: "cochon" }],
    };
    expect(decideKuhhandelInitiation(bot, [other], BOT_DIFFICULTY_PRESETS.normal)).toBeNull();
  });
});

describe("decideKuhhandelOffer / decideKuhhandelResponse", () => {
  it("composes an offer that never exceeds the bot's cash", () => {
    const bot = player();
    const offer = decideKuhhandelOffer(bot, BOT_DIFFICULTY_PRESETS.normal, rng);
    expect(totalValue(offer)).toBeLessThanOrEqual(totalValue(bot.money));
  });

  it("accepts when its own estimate of the species is low relative to its cash", () => {
    const target = player({ money: money(500, 500, 500) });
    const state = submitInitiatorOffer(
      startKuhhandel("initiator", target.id, "cochon", [{ id: "a-cochon", species: "cochon" }], target.animals),
      money(10),
    );
    const response = decideKuhhandelResponse(target, state, BOT_DIFFICULTY_PRESETS.normal, rng);
    expect(response.type).toBe("accept");
  });

  it("counters when the species estimate is high relative to its cash", () => {
    const target = player({ money: money(10) });
    const state = submitInitiatorOffer(
      startKuhhandel("initiator", target.id, "vache", [{ id: "a-vache", species: "vache" }], target.animals),
      money(500),
    );
    const response = decideKuhhandelResponse(target, state, BOT_DIFFICULTY_PRESETS.normal, rng);
    expect(response.type).toBe("counter");
  });
});
