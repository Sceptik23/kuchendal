import { describe, expect, it } from 'vitest';
import { GameRoom } from '../src/room/GameRoom.js';
import {
  DEEP_BANKROLL,
  groupedDeckFactory,
  moneyCardIdsFor,
  playAuctionOnlyThenConsolidate,
} from './helpers/playToGameOver.js';

describe('GameRoom — lobby', () => {
  it('rejects joining once the room is full (MAX_PLAYERS)', () => {
    const room = new GameRoom(() => 0);
    for (let i = 0; i < 6; i++) room.join(`p${i}`);

    expect(() => room.join('p7')).toThrow(/full/i);
  });

  it('refuses to start below the minimum player count', () => {
    const room = new GameRoom(() => 0);
    room.join('p1');
    room.join('p2');

    expect(() => room.start()).toThrow(/minimum|players/i);
  });

  it('deals starting money and the animal deck once started', () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join('p1');
    room.join('p2');
    room.join('p3');
    room.start();

    const view = room.getViewFor(p1);
    expect(view.status).toBe('in_progress');
    expect(view.deckCount).toBe(40);
    expect(view.players).toHaveLength(3);
    expect(view.players.find((p) => p.id === p1)!.moneyCount).toBeGreaterThan(0);
    expect(view.activePlayerId).toBe(p1);
  });
});

describe('GameRoom — information hiding in the state view', () => {
  it("never exposes another player's exact money hand, only its count", () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    room.join('p3');
    room.start();

    const viewForP1 = room.getViewFor(p1);
    const self = viewForP1.players.find((p) => p.id === p1)!;
    const other = viewForP1.players.find((p) => p.id === p2)!;

    expect(self.money).not.toBeNull();
    expect(other.money).toBeNull();
    expect(other.moneyCount).toBeGreaterThan(0);
  });
});

describe('GameRoom — auction turn', () => {
  it('resolves a full auction and advances the turn to the next player', () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    const p3 = room.join('p3');
    room.start();

    room.startAuction(p1);
    room.placeBid(p2, moneyCardIdsFor(room, p2, 10));
    room.pass(p3);
    room.sellerDecision(p1, 'sell');

    const view = room.getViewFor(p1);
    expect(view.deckCount).toBe(39);
    expect(view.players.find((p) => p.id === p2)!.animals).toHaveLength(1);
    expect(view.activePlayerId).toBe(p2);
  });

  it('rejects an auction action from a player who is not the current bidder', () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join('p1');
    room.join('p2');
    room.join('p3');
    room.start();

    room.startAuction(p1);

    expect(() => room.placeBid(p1, moneyCardIdsFor(room, p1, 10))).toThrow();
  });

  it('accepts a bid combined from multiple cards, and a keep payment combined from multiple cards', () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    const p3 = room.join('p3');
    room.start();

    room.startAuction(p1);
    // Starting money is 2×0, 4×10, 1×50 — combine two 10s for a bid no
    // single starting card matches exactly.
    const p2Money = room.getViewFor(p2).players.find((p) => p.id === p2)!.money!;
    const twoTens = p2Money.filter((c) => c.value === 10).slice(0, 2).map((c) => c.id);
    room.placeBid(p2, twoTens);
    room.pass(p3);

    const highestBid = room.getViewFor(p1).auction!.highestBid!;
    expect(highestBid.amount).toBe(20);

    const p1Money = room.getViewFor(p1).players.find((p) => p.id === p1)!.money!;
    const p1TwoTens = p1Money.filter((c) => c.value === 10).slice(0, 2).map((c) => c.id);
    room.sellerDecision(p1, 'keep', p1TwoTens);

    const view = room.getViewFor(p1);
    expect(view.players.find((p) => p.id === p1)!.animals).toHaveLength(1); // seller kept the card
    // On 'keep' the bidder's committed bid cards are never actually
    // transferred (no sale happened) — the bidder simply receives the
    // seller's payment on top of their untouched hand.
    expect(view.players.find((p) => p.id === p2)!.moneyCount).toBe(p2Money.length + p1TwoTens.length);
  });

  it('rejects a keep payment that does not sum to exactly the highest bid', () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    const p3 = room.join('p3');
    room.start();

    room.startAuction(p1);
    const p2Money = room.getViewFor(p2).players.find((p) => p.id === p2)!.money!;
    room.placeBid(p2, [p2Money.find((c) => c.value === 50)!.id]);
    room.pass(p3);

    const p1Money = room.getViewFor(p1).players.find((p) => p.id === p1)!.money!;
    const wrongCards = p1Money.filter((c) => c.value === 10).slice(0, 2).map((c) => c.id); // sums to 20, not 50
    expect(() => room.sellerDecision(p1, 'keep', wrongCards)).toThrow(/exactly/i);
  });

  it('rejects a bid that reuses the same money card ID more than once (resolveOffer dedup)', () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    room.join('p3');
    room.start();

    room.startAuction(p1);
    const p2Money = room.getViewFor(p2).players.find((p) => p.id === p2)!.money!;
    const sameCardId = p2Money.find((c) => c.value === 10)!.id;

    // A single 10-value card repeated 3x should not be treated as a bid of
    // 30 — that would create money the bidder never actually holds.
    expect(() => room.placeBid(p2, [sameCardId, sameCardId, sameCardId])).toThrow(
      /cannot use the same money card/i,
    );
  });
});

describe('GameRoom — Kuhhandel turn', () => {
  it('lets the active player initiate a Kuhhandel instead of an auction, without drawing a card', () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    const p3 = room.join('p3');
    room.start();

    // Deck order for rng=()=>0 starts with three "coq" cards in a row.
    room.startAuction(p1);
    room.placeBid(p2, moneyCardIdsFor(room, p2, 10));
    room.pass(p3);
    room.sellerDecision(p1, 'sell'); // p2 now owns 1 coq

    room.startAuction(p2);
    room.placeBid(p3, moneyCardIdsFor(room, p3, 10));
    room.pass(p1);
    room.sellerDecision(p2, 'sell'); // p3 now owns 1 coq

    const deckCountBeforeKuhhandel = room.getViewFor(p3).deckCount;

    room.startKuhhandel(p3, p2, 'coq');
    const offer = room
      .getViewFor(p3)
      .players.find((p) => p.id === p3)!
      .money!.slice(0, 1)
      .map((c) => c.id);
    room.submitOffer(p3, offer);
    room.respondAccept(p2);

    const view = room.getViewFor(p1);
    expect(view.deckCount).toBe(deckCountBeforeKuhhandel);
    expect(view.players.find((p) => p.id === p3)!.animals).toHaveLength(2);
    expect(view.players.find((p) => p.id === p2)!.animals).toHaveLength(0);
    expect(view.activePlayerId).toBe(p1);
  });

  it('never exposes the secret offer to the target before it is resolved', () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    const p3 = room.join('p3');
    room.start();

    room.startAuction(p1);
    room.placeBid(p2, moneyCardIdsFor(room, p2, 10));
    room.pass(p3);
    room.sellerDecision(p1, 'sell');

    room.startAuction(p2);
    room.placeBid(p3, moneyCardIdsFor(room, p3, 10));
    room.pass(p1);
    room.sellerDecision(p2, 'sell');

    room.startKuhhandel(p3, p2, 'coq');
    const offer = room
      .getViewFor(p3)
      .players.find((p) => p.id === p3)!
      .money!.slice(0, 1)
      .map((c) => c.id);
    room.submitOffer(p3, offer);

    const targetView = room.getViewFor(p2).kuhhandel;
    expect(targetView?.initiatorOffer).toBeNull();

    const initiatorView = room.getViewFor(p3).kuhhandel;
    expect(initiatorView?.initiatorOffer).not.toBeNull();
  });
});

describe('GameRoom — full game to GAME_OVER', () => {
  it('finishes once the deck is exhausted and computes final scores', () => {
    // Deep, single-denomination bankroll plus a deterministic grouped deck:
    // this test drives the full auction phase, then the forced-Kuhhandel
    // consolidation phase (real end condition = all species families
    // complete, not merely deck-empty — see room.forcedKuhhandel.test.ts),
    // to prove the full turn/deck/scoring loop reaches a true GAME_OVER.
    const room = new GameRoom(() => 0, DEEP_BANKROLL, undefined, undefined, undefined, groupedDeckFactory);
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    const p3 = room.join('p3');
    room.start();

    playAuctionOnlyThenConsolidate(room, [p1, p2, p3]);

    const view = room.getViewFor(p1);
    expect(view.deckCount).toBe(0);
    expect(view.status).toBe('finished');
    for (const player of view.players) {
      expect(player.score).not.toBeNull();
    }
  });
});
