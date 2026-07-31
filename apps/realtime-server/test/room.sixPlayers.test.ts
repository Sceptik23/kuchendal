import { describe, expect, it } from 'vitest';
import { GameRoom } from '../src/room/GameRoom.js';
import { MAX_PLAYERS } from '@kuhhandel/game-engine';
import type { AnimalCard } from '@kuhhandel/game-engine';
import { SPECIES_KEYS } from '@kuhhandel/game-engine';

const SIX_IDS = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'];

function joinSix(room: GameRoom): string[] {
  return SIX_IDS.map((name) => room.join(name));
}

/**
 * Deck whose first four cards are all four ânes, so a room can trigger every
 * golden-donkey bonus payout (50/100/200/500 to every player) back to back and
 * drain the shared 55-card money bank as hard as the rules allow.
 */
function donkeyFirstDeckFactory(): AnimalCard[] {
  const cards: AnimalCard[] = [];
  for (let i = 0; i < 4; i++) cards.push({ id: `ane-${i}`, species: 'ane' });
  for (const species of SPECIES_KEYS) {
    if (species === 'ane') continue;
    for (let i = 0; i < 4; i++) cards.push({ id: `${species}-${i}`, species });
  }
  return cards;
}

describe('GameRoom — 6 players (MAX_PLAYERS) against the finite money bank', () => {
  it('is a permitted player count', () => {
    expect(MAX_PLAYERS).toBe(6);
    expect(SIX_IDS).toHaveLength(MAX_PLAYERS);
  });

  it('deals cleanly at 6 players: nobody is starved and nobody gets a runaway bankroll', () => {
    const room = new GameRoom(() => 0);
    const ids = joinSix(room);

    expect(() => room.start()).not.toThrow();

    const totals: number[] = [];
    for (const id of ids) {
      const view = room.getViewFor(id);
      const own = view.players.find((p) => p.id === id)!;
      expect(own.money).not.toBeNull();
      expect(own.money!.length).toBeGreaterThan(0);
      const total = own.money!.reduce((sum, card) => sum + card.value, 0);
      expect(total).toBeGreaterThanOrEqual(90);
      totals.push(total);
    }

    // Regression guard for the sequential-dealing bug, where the last player
    // dealt received 450 against everyone else's 90.
    expect(Math.max(...totals) / Math.min(...totals)).toBeLessThan(2);
    expect(Math.max(...totals)).toBeLessThanOrEqual(3 * 90);
  });

  it('every player can read their own and every opponent view without throwing', () => {
    const room = new GameRoom(() => 0);
    const ids = joinSix(room);
    room.start();

    for (const id of ids) {
      expect(() => room.getViewFor(id)).not.toThrow();
      const view = room.getViewFor(id);
      expect(view.players).toHaveLength(6);
      for (const opponent of view.players) {
        expect(opponent.moneyCount).toBeGreaterThan(0);
        // Only the viewer's own hand is revealed.
        expect(opponent.money === null).toBe(opponent.id !== id);
      }
    }
  });

  it('survives all four golden donkey payouts at 6 players without wedging the room', () => {
    const room = new GameRoom(() => 0, undefined, undefined, undefined, undefined, donkeyFirstDeckFactory);
    const ids = joinSix(room);
    room.start();

    expect(room.getViewFor(ids[0]!).donkeyRevealCount).toBe(0);

    // Four consecutive ânes: 6 players × 4 reveals = 24 bonus draws on top of
    // the 42 starting cards, well past the box's 55-card supply.
    for (let reveal = 0; reveal < 4; reveal++) {
      const active = room.getViewFor(ids[0]!).activePlayerId;
      expect(() => room.startAuction(active)).not.toThrow();
      // Everyone but the seller passes, so the seller keeps the card.
      for (const id of ids) {
        if (id !== active) room.pass(id);
      }
      expect(() => room.sellerDecision(active, 'keep')).not.toThrow();
      expect(room.getViewFor(ids[0]!).donkeyRevealCount).toBe(reveal + 1);
    }

    for (const id of ids) {
      const own = room.getViewFor(id).players.find((p) => p.id === id)!;
      expect(own.money!.length).toBeGreaterThan(0);
    }
    expect(room.getSummary().status).toBe('in_progress');
  });
});
