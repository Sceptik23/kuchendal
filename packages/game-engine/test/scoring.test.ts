import { describe, expect, it } from 'vitest';
import { computeScore, isGameOver, nextPlayerIndex } from '../src/scoring/scoring.js';
import type { AnimalCard, Player } from '../src/types.js';

function animals(...species: AnimalCard['species'][]): AnimalCard[] {
  return species.map((s, i) => ({ id: `${s}-${i}`, species: s }));
}

describe('computeScore', () => {
  it('applies the family-count multiplier (rulebook worked example, GDD §4)', () => {
    const player: Player = {
      id: 'p1',
      name: 'P1',
      money: [],
      animals: [
        ...animals('cochon', 'cochon', 'cochon', 'cochon'), // 650
        ...animals('chien', 'chien', 'chien', 'chien'), // 160
        ...animals('coq', 'coq', 'coq', 'coq'), // 10
      ],
    };

    // 650 + 160 + 10 = 820, × 3 complete families = 2460
    expect(computeScore(player)).toBe(2460);
  });

  it('gives zero value to incomplete families and does not count them toward the multiplier', () => {
    const player: Player = {
      id: 'p1',
      name: 'P1',
      money: [],
      animals: animals('cochon', 'cochon'), // incomplete
    };

    expect(computeScore(player)).toBe(0);
  });

  it('applies a ×1 multiplier for exactly one complete family', () => {
    const player: Player = {
      id: 'p1',
      name: 'P1',
      money: [],
      animals: [
        ...animals('cochon', 'cochon', 'cochon', 'cochon'), // 650
        ...animals('oie', 'oie'), // incomplete, 0
      ],
    };

    expect(computeScore(player)).toBe(650);
  });

  it('applies the multiplier across all ten families when every family is complete', () => {
    const player: Player = {
      id: 'p1',
      name: 'P1',
      money: [],
      animals: [
        ...animals('coq', 'coq', 'coq', 'coq'), // 10
        ...animals('oie', 'oie', 'oie', 'oie'), // 40
        ...animals('chat', 'chat', 'chat', 'chat'), // 90
        ...animals('chien', 'chien', 'chien', 'chien'), // 160
        ...animals('mouton', 'mouton', 'mouton', 'mouton'), // 250
        ...animals('chevre', 'chevre', 'chevre', 'chevre'), // 350
        ...animals('ane', 'ane', 'ane', 'ane'), // 500
        ...animals('cochon', 'cochon', 'cochon', 'cochon'), // 650
        ...animals('vache', 'vache', 'vache', 'vache'), // 800
        ...animals('cheval', 'cheval', 'cheval', 'cheval'), // 1000
      ],
    };

    // sum = 10+40+90+160+250+350+500+650+800+1000 = 3850, ×10 = 38500
    expect(computeScore(player)).toBe(38500);
  });

  it('does not count remaining money in the score (GDD §5 default)', () => {
    const player: Player = {
      id: 'p1',
      name: 'P1',
      money: [{ id: 'm1', value: 500 }],
      animals: [],
    };

    expect(computeScore(player)).toBe(0);
  });
});

describe('isGameOver', () => {
  it('is over once the animal deck is exhausted', () => {
    expect(isGameOver([])).toBe(true);
    expect(isGameOver([{ id: 'a', species: 'vache' }])).toBe(false);
  });
});

describe('nextPlayerIndex', () => {
  it('advances to the next player, wrapping around', () => {
    expect(nextPlayerIndex(0, 3)).toBe(1);
    expect(nextPlayerIndex(1, 3)).toBe(2);
    expect(nextPlayerIndex(2, 3)).toBe(0);
  });
});
