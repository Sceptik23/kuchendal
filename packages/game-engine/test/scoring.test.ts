import { describe, expect, it } from 'vitest';
import { computeScore, isGameOver, nextPlayerIndex } from '../src/scoring/scoring.js';
import type { AnimalCard, Player } from '../src/types.js';

function animals(...species: AnimalCard['species'][]): AnimalCard[] {
  return species.map((s, i) => ({ id: `${s}-${i}`, species: s }));
}

describe('computeScore', () => {
  it('counts only complete families (GDD §4)', () => {
    const player: Player = {
      id: 'p1',
      name: 'P1',
      money: [],
      animals: animals('cochon', 'cochon', 'cochon', 'cochon'), // complete: 100
    };

    expect(computeScore(player)).toBe(100);
  });

  it('gives zero value to incomplete families', () => {
    const player: Player = {
      id: 'p1',
      name: 'P1',
      money: [],
      animals: animals('cochon', 'cochon'), // incomplete
    };

    expect(computeScore(player)).toBe(0);
  });

  it('sums multiple complete families and ignores incomplete ones', () => {
    const player: Player = {
      id: 'p1',
      name: 'P1',
      money: [],
      animals: [
        ...animals('cochon', 'cochon', 'cochon', 'cochon'), // 100
        ...animals('vache', 'vache', 'vache', 'vache'), // 1500
        ...animals('oie', 'oie'), // incomplete, 0
      ],
    };

    expect(computeScore(player)).toBe(1600);
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
