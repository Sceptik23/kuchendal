import { describe, expect, it } from 'vitest';
import { CARDS_PER_SPECIES, SPECIES_KEYS } from '../src/config/species.config.js';
import { MONEY_DENOMINATIONS, STARTING_MONEY } from '../src/config/money.config.js';
import { createShuffledDeck } from '../src/setup/createDeck.js';
import { createStartingMoney } from '../src/setup/createStartingMoney.js';

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

describe('createStartingMoney', () => {
  it('gives each player the configured starting money hand', () => {
    const hand = createStartingMoney();

    const expectedCount = Object.values(STARTING_MONEY).reduce((a, b) => a + b, 0);
    expect(hand).toHaveLength(expectedCount);

    for (const denomination of MONEY_DENOMINATIONS) {
      expect(hand.filter((card) => card.value === denomination)).toHaveLength(
        STARTING_MONEY[denomination],
      );
    }
  });

  it('gives each player independent card instances', () => {
    const handA = createStartingMoney();
    const handB = createStartingMoney();

    handA[0]!.id = 'mutated';
    expect(handB[0]!.id).not.toBe('mutated');
  });
});
