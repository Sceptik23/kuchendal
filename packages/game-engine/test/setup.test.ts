import { describe, expect, it } from 'vitest';
import { CARDS_PER_SPECIES, SPECIES_KEYS } from '../src/config/species.config.js';
import { MONEY_DENOMINATIONS, STARTING_MONEY } from '../src/config/money.config.js';
import { createShuffledDeck } from '../src/setup/createDeck.js';
import { createMoneyBank } from '../src/money/moneyBank.js';
import { dealStartingMoney } from '../src/setup/createStartingMoney.js';

describe('createShuffledDeck', () => {
  it('creates 40 animal cards, 4 per species', () => {
    const deck = createShuffledDeck(() => 0.5);

    expect(deck).toHaveLength(SPECIES_KEYS.length * CARDS_PER_SPECIES);
    for (const species of SPECIES_KEYS) {
      expect(deck.filter((card) => card.species === species)).toHaveLength(CARDS_PER_SPECIES);
    }
  });

  it('shuffles deterministically given the same RNG sequence', () => {
    const deckA = createShuffledDeck(() => 0.3);
    const deckB = createShuffledDeck(() => 0.3);

    expect(deckA.map((c) => c.id)).toEqual(deckB.map((c) => c.id));
  });

  it('produces a different order for a different RNG sequence', () => {
    const deckA = createShuffledDeck(() => 0.1);
    const deckB = createShuffledDeck(() => 0.9);

    expect(deckA.map((c) => c.id)).not.toEqual(deckB.map((c) => c.id));
  });
});

describe('dealStartingMoney', () => {
  it('gives each player the configured starting money hand (90 total, rulebook)', () => {
    const bank = createMoneyBank();
    const { hands } = dealStartingMoney(bank, 3);

    const expectedCount = Object.values(STARTING_MONEY).reduce((a, b) => a + b, 0);
    expect(expectedCount).toBe(7); // 2×0 + 4×10 + 1×50

    for (const hand of hands) {
      expect(hand).toHaveLength(expectedCount);
      expect(hand.reduce((sum, c) => sum + c.value, 0)).toBe(90);
      for (const denomination of MONEY_DENOMINATIONS) {
        expect(hand.filter((card) => card.value === denomination)).toHaveLength(
          STARTING_MONEY[denomination],
        );
      }
    }
  });

  it('gives each player independent card instances drawn from a shrinking bank', () => {
    const bank = createMoneyBank();
    const { bank: next, hands } = dealStartingMoney(bank, 3);

    hands[0]![0]!.id = 'mutated';
    expect(hands[1]![0]!.id).not.toBe('mutated');

    // 3 players × (2×0 + 4×10 + 1×50) = 6×0, 12×10, 3×50 drawn
    expect(next.counts[0]).toBe(10 - 6);
    expect(next.counts[10]).toBe(20 - 12);
    expect(next.counts[50]).toBe(10 - 3);
  });
});
