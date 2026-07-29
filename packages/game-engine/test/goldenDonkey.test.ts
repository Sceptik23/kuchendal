import { describe, expect, it } from 'vitest';
import { createMoneyBank } from '../src/money/moneyBank.js';
import {
  DONKEY_BONUS_SEQUENCE,
  isGoldenDonkeyCard,
  distributeGoldenDonkeyBonus,
} from '../src/kuhhandel/goldenDonkey.js';
import type { Player } from '../src/types.js';

function makePlayers(ids: string[]): Player[] {
  return ids.map((id) => ({ id, name: id, money: [], animals: [] }));
}

describe('isGoldenDonkeyCard', () => {
  it('is true only for the âne species', () => {
    expect(isGoldenDonkeyCard({ id: 'ane-0', species: 'ane' })).toBe(true);
    expect(isGoldenDonkeyCard({ id: 'vache-0', species: 'vache' })).toBe(false);
  });
});

describe('distributeGoldenDonkeyBonus', () => {
  it('gives every player one bonus card at the rulebook sequence (50/100/200/500)', () => {
    const bank = createMoneyBank();
    let players = makePlayers(['p1', 'p2', 'p3']);

    for (let reveal = 0; reveal < DONKEY_BONUS_SEQUENCE.length; reveal++) {
      const result = distributeGoldenDonkeyBonus(bank, players, reveal);
      players = result.players;
      for (const player of players) {
        const bonusCards = player.money.filter((c) => c.value === DONKEY_BONUS_SEQUENCE[reveal]);
        expect(bonusCards.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('gives exactly one card per player and decrements the bank accordingly', () => {
    const bank = createMoneyBank();
    const players = makePlayers(['p1', 'p2']);

    const { bank: next, players: updated } = distributeGoldenDonkeyBonus(bank, players, 0);

    for (const player of updated) {
      expect(player.money).toHaveLength(1);
      expect(player.money[0]!.value).toBe(50);
    }
    expect(next.counts[50]).toBe(bank.counts[50] - 2);
  });
});
