import { CARDS_PER_SPECIES, SPECIES_FAMILY_VALUE, SPECIES_KEYS } from '../config/species.config.js';
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

/** True once the 40-card animal deck has nothing left to auction. Auctions stop here, but the game itself isn't over yet — see `isGameOver`. */
export function isDeckExhausted(deck: AnimalCard[]): boolean {
  return deck.length === 0;
}

/** True once every one of the 10 species has all 4 of its cards held by a single player (rulebook: "quand toutes les familles sont complètes"). */
export function isGameOver(players: Player[]): boolean {
  return SPECIES_KEYS.every((species) =>
    players.some((p) => p.animals.filter((a) => a.species === species).length >= CARDS_PER_SPECIES),
  );
}

/** True if the player holds any species in a count below a full family — i.e. they still have something tradeable. Used to auto-pass players during the forced-Kuhhandel end-game phase who hold only complete families (or nothing). */
export function hasIncompleteFamilyAnimal(animals: AnimalCard[]): boolean {
  const counts = new Map<AnimalCard['species'], number>();
  for (const card of animals) {
    counts.set(card.species, (counts.get(card.species) ?? 0) + 1);
  }
  for (const count of counts.values()) {
    if (count < CARDS_PER_SPECIES) return true;
  }
  return false;
}

export function nextPlayerIndex(current: number, playerCount: number): number {
  return (current + 1) % playerCount;
}
