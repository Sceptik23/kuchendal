import { describe, expect, it } from 'vitest';
import { createShuffledDeck } from '../src/setup/createDeck.js';
import { startAuction, placeBid, pass, resolveAuction } from '../src/auction/auction.js';
import {
  startKuhhandel,
  submitInitiatorOffer,
  respondAccept,
  respondCounter,
} from '../src/kuhhandel/kuhhandel.js';
import { applyAuctionResult, applyKuhhandelResult } from '../src/engine/applyResults.js';
import { computeScore, isGameOver, nextPlayerIndex } from '../src/scoring/scoring.js';
import type { AnimalCard, Player } from '../src/types.js';

/**
 * The engine only moves exact-denomination cards (cf. applyResults.ts —
 * making change from mismatched bills is a player/UI decision, not a core
 * rule enforced by Phase 1). This test drives 40 auctions with the same
 * bid amount, so it needs a deep bankroll of that denomination to avoid
 * hitting that documented limitation; it is not testing the economy.
 */
function makePlayersWithDeepBankroll(ids: string[]): Player[] {
  return ids.map((id) => ({
    id,
    name: id,
    money: Array.from({ length: 20 }, (_, i) => ({ id: `${id}-m${i}`, value: 10 as const })),
    animals: [],
  }));
}

describe('full scripted game — auction-only playthrough to GAME_OVER', () => {
  it('plays every animal card in the deck via auctions and reaches a valid final score', () => {
    let players = makePlayersWithDeepBankroll(['p1', 'p2', 'p3']);
    let deck: AnimalCard[] = createShuffledDeck(() => 0.42);
    let activePlayerIndex = 0;
    let cardsResolved = 0;

    while (!isGameOver(deck)) {
      const card = deck[0]!;
      deck = deck.slice(1);

      const seller = players[activePlayerIndex]!;
      const bidders = players.filter((p) => p.id !== seller.id).map((p) => p.id);

      let auctionState = startAuction(card, seller.id, bidders);
      const bidderId = bidders[0]!;
      auctionState = placeBid(auctionState, bidderId, 10);
      auctionState = pass(auctionState, bidders[1]!);

      const decision = cardsResolved % 5 === 0 ? 'keep' : 'sell';
      const result = resolveAuction(auctionState, decision);

      players = applyAuctionResult(players, result);

      cardsResolved++;
      activePlayerIndex = nextPlayerIndex(activePlayerIndex, players.length);
    }

    expect(deck).toHaveLength(0);
    expect(cardsResolved).toBe(40);

    const totalAnimalsHeld = players.reduce((sum, p) => sum + p.animals.length, 0);
    expect(totalAnimalsHeld).toBe(40);

    const scores = players.map((p) => ({ id: p.id, score: computeScore(p) }));
    for (const { score } of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
    }
    const winner = scores.reduce((best, s) => (s.score > best.score ? s : best));
    expect(winner.score).toBeGreaterThanOrEqual(0);
  });
});

describe('full scripted game — Kuhhandel applied to real player hands', () => {
  it('accept: transfers the animal and the exact offered money between the two real players', () => {
    let players: Player[] = [
      {
        id: 'initiator',
        name: 'initiator',
        money: [{ id: 'm-100', value: 100 }],
        animals: [{ id: 'vache-a', species: 'vache' }],
      },
      {
        id: 'target',
        name: 'target',
        money: [],
        animals: [{ id: 'vache-b', species: 'vache' }],
      },
    ];

    let state = startKuhhandel('initiator', 'target', 'vache');
    const offer = [players[0]!.money[0]!];
    state = submitInitiatorOffer(state, offer);

    const result = respondAccept(state);
    players = applyKuhhandelResult(players, result);

    const initiator = players.find((p) => p.id === 'initiator')!;
    const target = players.find((p) => p.id === 'target')!;

    expect(initiator.money).toHaveLength(0);
    expect(initiator.animals.map((a) => a.id)).toEqual(
      expect.arrayContaining(['vache-a', 'vache-b']),
    );
    expect(target.money.map((m) => m.id)).toEqual(['m-100']);
    expect(target.animals).toHaveLength(0);
  });

  it('counter: only the animal moves — each side keeps the money it staked', () => {
    let players: Player[] = [
      {
        id: 'initiator',
        name: 'initiator',
        money: [{ id: 'm-100', value: 100 }],
        animals: [{ id: 'vache-a', species: 'vache' }],
      },
      {
        id: 'target',
        name: 'target',
        money: [{ id: 'm-50', value: 50 }],
        animals: [{ id: 'vache-b', species: 'vache' }],
      },
    ];

    let state = startKuhhandel('initiator', 'target', 'vache');
    state = submitInitiatorOffer(state, [players[0]!.money[0]!]);

    const result = respondCounter(state, [players[1]!.money[0]!]);
    expect(result.type).toBe('counter_resolved');

    players = applyKuhhandelResult(players, result);

    const initiator = players.find((p) => p.id === 'initiator')!;
    const target = players.find((p) => p.id === 'target')!;

    expect(initiator.animals.map((a) => a.id)).toEqual(
      expect.arrayContaining(['vache-a', 'vache-b']),
    );
    expect(initiator.money.map((m) => m.id)).toEqual(['m-100']); // kept their own stake only
    expect(target.animals).toHaveLength(0);
    expect(target.money.map((m) => m.id)).toEqual(['m-50']); // kept their own stake too
  });
});
