import { describe, expect, it } from 'vitest';
import { GameRoom } from '../src/room/GameRoom.js';

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
    room.placeBid(p2, 10);
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

    expect(() => room.placeBid(p1, 10)).toThrow();
  });
});

describe('GameRoom — Kuhhandel turn', () => {
  it('lets the active player initiate a Kuhhandel instead of an auction, without drawing a card', () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    const p3 = room.join('p3');
    room.start();

    // Deck order for rng=()=>0 starts with three "cochon" cards in a row.
    room.startAuction(p1);
    room.placeBid(p2, 10);
    room.pass(p3);
    room.sellerDecision(p1, 'sell'); // p2 now owns 1 cochon

    room.startAuction(p2);
    room.placeBid(p3, 10);
    room.pass(p1);
    room.sellerDecision(p2, 'sell'); // p3 now owns 1 cochon

    const deckCountBeforeKuhhandel = room.getViewFor(p3).deckCount;

    room.startKuhhandel(p3, p2, 'cochon');
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
    room.placeBid(p2, 10);
    room.pass(p3);
    room.sellerDecision(p1, 'sell');

    room.startAuction(p2);
    room.placeBid(p3, 10);
    room.pass(p1);
    room.sellerDecision(p2, 'sell');

    room.startKuhhandel(p3, p2, 'cochon');
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
    // Deep, single-denomination bankroll: this test drives 40 fixed-amount
    // bids to prove the full turn/deck/scoring loop reaches GAME_OVER, not
    // to exercise exact-change bookkeeping (a documented Phase 1 limitation
    // of the underlying game-engine, cf. applyResults.ts).
    const deepBankroll = () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: `deep-${i}-${Math.random()}`,
        value: 10 as const,
      }));
    const room = new GameRoom(() => 0, deepBankroll);
    const p1 = room.join('p1');
    room.join('p2');
    room.join('p3');
    room.start();

    let view = room.getViewFor(p1);
    while (view.status === 'in_progress') {
      const activeId = view.activePlayerId!;
      const others = view.players.map((p) => p.id).filter((id) => id !== activeId);

      room.startAuction(activeId);
      room.placeBid(others[0]!, 10);
      room.pass(others[1]!);
      room.sellerDecision(activeId, 'sell');

      view = room.getViewFor(p1);
    }

    expect(view.deckCount).toBe(0);
    expect(view.status).toBe('finished');
    for (const player of view.players) {
      expect(player.score).not.toBeNull();
    }
  });
});
