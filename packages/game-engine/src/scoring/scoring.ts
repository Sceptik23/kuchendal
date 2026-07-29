import { CARDS_PER_SPECIES, SPECIES_FAMILY_VALUE } from '../config/species.config.js';
import type { AnimalCard, Player } from '../types.js';

export function computeScore(player: Player): number {
  const countBySpecies = new Map<AnimalCard['species'], number>();
  for (const card of player.animals) {
    countBySpecies.set(card.species, (countBySpecies.get(card.species) ?? 0) + 1);
  }

  let completeFamiliesValue = 0;
  let completeFamiliesCount = 0;
  for (const [species, count] of countBySpecies) {
    if (count >= CARDS_PER_SPECIES) {
      completeFamiliesValue += SPECIES_FAMILY_VALUE[species];
      completeFamiliesCount += 1;
    }
  }
  return completeFamiliesValue * completeFamiliesCount;
}

export function isGameOver(deck: AnimalCard[]): boolean {
  return deck.length === 0;
}

export function nextPlayerIndex(current: number, playerCount: number): number {
  return (current + 1) % playerCount;
}
