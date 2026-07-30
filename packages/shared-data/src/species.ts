/**
 * Single source of truth for the species roster/values, imported by both
 * `@kuhhandel/game-engine` (server rules) and `@kuhhandel/shared-types`
 * (browser bundle) so the two never drift out of sync. Pure data, no
 * logic — safe to bundle in the client without pulling in engine code.
 */
export const SPECIES_KEYS = [
  'coq',
  'oie',
  'chat',
  'chien',
  'mouton',
  'chevre',
  'ane',
  'cochon',
  'vache',
  'cheval',
] as const;

export type SpeciesKey = (typeof SPECIES_KEYS)[number];

export const SPECIES_FAMILY_VALUE: Record<SpeciesKey, number> = {
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
};

export const CARDS_PER_SPECIES = 4;
