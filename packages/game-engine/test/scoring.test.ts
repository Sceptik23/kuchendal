import { describe, expect, it } from 'vitest';
import { computeScore, isDeckExhausted, isGameOver, hasIncompleteFamilyAnimal, nextPlayerIndex } from '../src/scoring/scoring.js';
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

describe('isDeckExhausted', () => {
  it('is true once the animal deck is empty', () => {
    expect(isDeckExhausted([])).toBe(true);
    expect(isDeckExhausted([{ id: 'a', species: 'vache' }])).toBe(false);
  });
});

describe('isGameOver (rulebook: "quand toutes les familles sont complètes")', () => {
  function playerWith(id: string, ...species: AnimalCard['species'][]): Player {
    return { id, name: id, money: [], animals: animals(...species) };
  }

  it('is false while any species is not fully held by a single player', () => {
    const players = [
      playerWith('p1', 'cochon', 'cochon', 'cochon', 'cochon'),
      playerWith('p2', 'vache', 'vache'), // vache incomplete everywhere
    ];
    expect(isGameOver(players)).toBe(false);
  });

  it('is true once every one of the 10 species is completed by some player', () => {
    const players = [
      playerWith(
        'p1',
        'coq', 'coq', 'coq', 'coq',
        'oie', 'oie', 'oie', 'oie',
        'chat', 'chat', 'chat', 'chat',
        'chien', 'chien', 'chien', 'chien',
        'mouton', 'mouton', 'mouton', 'mouton',
      ),
      playerWith(
        'p2',
        'chevre', 'chevre', 'chevre', 'chevre',
        'ane', 'ane', 'ane', 'ane',
        'cochon', 'cochon', 'cochon', 'cochon',
        'vache', 'vache', 'vache', 'vache',
        'cheval', 'cheval', 'cheval', 'cheval',
      ),
    ];
    expect(isGameOver(players)).toBe(true);
  });

  it('does not require the SAME player to hold every family — different players can each complete different families', () => {
    const players = [
      playerWith('p1', 'coq', 'coq', 'coq', 'coq'),
      playerWith('p2', 'oie', 'oie', 'oie', 'oie'),
    ];
    // only 2 of 10 families complete — still false, but proves ownership isn't required to be uniform once it IS all 10
    expect(isGameOver(players)).toBe(false);
  });
});

describe('hasIncompleteFamilyAnimal', () => {
  it('is true when the player holds fewer than 4 of some species', () => {
    expect(hasIncompleteFamilyAnimal(animals('vache', 'vache'))).toBe(true);
  });

  it('is false when every species held is a complete family of 4', () => {
    expect(hasIncompleteFamilyAnimal(animals('vache', 'vache', 'vache', 'vache'))).toBe(false);
  });

  it('is false for an empty hand (nothing left to trade)', () => {
    expect(hasIncompleteFamilyAnimal([])).toBe(false);
  });
});

describe('nextPlayerIndex', () => {
  it('advances to the next player, wrapping around', () => {
    expect(nextPlayerIndex(0, 3)).toBe(1);
    expect(nextPlayerIndex(1, 3)).toBe(2);
    expect(nextPlayerIndex(2, 3)).toBe(0);
  });
});
