import { CARDS_PER_SPECIES, SPECIES_KEYS } from '../config/species.config.js';
import type { AnimalCard } from '../types.js';

export type RandomSource = () => number;

function shuffle<T>(items: T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

export function createShuffledDeck(random: RandomSource): AnimalCard[] {
  const cards: AnimalCard[] = [];
  for (const species of SPECIES_KEYS) {
    for (let i = 0; i < CARDS_PER_SPECIES; i++) {
      cards.push({ id: `${species}-${i}`, species });
    }
  }
  return shuffle(cards, random);
}
