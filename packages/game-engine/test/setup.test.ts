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
  it.each([3, 4, 5])(
    'gives each of %i players the exact configured starting hand (90 total, rulebook)',
    (playerCount) => {
      const bank = createMoneyBank();
      const { hands } = dealStartingMoney(bank, playerCount);

      const expectedCount = Object.values(STARTING_MONEY).reduce((a, b) => a + b, 0);
      expect(expectedCount).toBe(7); // 2×0 + 4×10 + 1×50
      expect(hands).toHaveLength(playerCount);

      for (const hand of hands) {
        expect(hand).toHaveLength(expectedCount);
        expect(hand.reduce((sum, c) => sum + c.value, 0)).toBe(90);
        for (const denomination of MONEY_DENOMINATIONS) {
          expect(hand.filter((card) => card.value === denomination)).toHaveLength(
            STARTING_MONEY[denomination],
          );
        }
      }
    },
  );

  it('spreads the unavoidable 6-player shortfall instead of dumping it on one player', () => {
    // 6 players need 12×"0" and 24×"10" but the box holds only 10 and 20, so
    // some substitution is structurally unavoidable. Round-robin dealing must
    // keep it fair: sequential dealing used to give the last player 450 (5×
    // everyone else's 90).
    const { hands } = dealStartingMoney(createMoneyBank(), 6);
    const totals = hands.map((hand) => hand.reduce((sum, card) => sum + card.value, 0));

    expect(hands).toHaveLength(6);
    for (const hand of hands) {
      expect(hand).toHaveLength(7); // everyone still gets 7 physical cards
    }

    // No player is starved and nobody gets a runaway advantage.
    expect(Math.min(...totals)).toBeGreaterThanOrEqual(90);
    expect(Math.max(...totals)).toBeLessThanOrEqual(3 * 90);
    expect(Math.max(...totals) / Math.min(...totals)).toBeLessThan(2);

    // The shortfall is a redistribution, not inflation: the total dealt is the
    // same as the old sequential deal handed out.
    expect(totals.reduce((a, b) => a + b, 0)).toBe(900);
  });

  it('never throws at the maximum supported player count', () => {
    expect(() => dealStartingMoney(createMoneyBank(), 6)).not.toThrow();
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
