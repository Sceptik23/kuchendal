import { describe, expect, it } from 'vitest';
import { CARDS_PER_SPECIES, SPECIES_KEYS, SPECIES_FAMILY_VALUE } from '../src/species.js';

describe('species data', () => {
  it('has the 10 real Kuhhandel species, no boeuf', () => {
    expect(SPECIES_KEYS).toHaveLength(10);
    expect(SPECIES_KEYS).not.toContain('boeuf');
    expect(SPECIES_KEYS).toContain('coq');
  });

  it('matches the rulebook value table', () => {
    expect(SPECIES_FAMILY_VALUE).toEqual({
      coq: 10,
      oie: 40,
      chat: 90,
      chien: 160,
      mouton: 250,
      chevre: 350,
      ane: 500,
      cochon: 650,
      vache: 800,
      cheval: 1000,
    });
  });

  it('has 4 cards per species', () => {
    expect(CARDS_PER_SPECIES).toBe(4);
  });
});
