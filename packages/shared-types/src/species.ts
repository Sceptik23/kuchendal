/**
 * Deliberately duplicated, static copy of
 * `packages/game-engine/src/config/species.config.ts`'s `SPECIES_FAMILY_VALUE`
 * / `SpeciesKey`.
 *
 * `@kuhhandel/shared-types` is consumed directly by the browser bundle
 * (`apps/web`). A live re-export of this value from `@kuhhandel/game-engine`
 * would pull that package's whole barrel (`auction.js`, `kuhhandel.js`,
 * `scoring.js`, `applyResults.js`, `createDeck.js`, ...) toward the client
 * bundle via an undeclared, tree-shaking-unfriendly dependency — neither
 * package declares `"sideEffects": false`, so webpack can't reliably prune
 * the unused re-exported modules. Keeping this table as a small static copy
 * avoids that coupling entirely.
 *
 * Keep this in sync manually with `species.config.ts` if the value table
 * ever changes.
 */
export const SPECIES_KEYS = [
  "cochon",
  "oie",
  "mouton",
  "chevre",
  "ane",
  "chien",
  "chat",
  "cheval",
  "boeuf",
  "vache",
] as const;

export type SpeciesKey = (typeof SPECIES_KEYS)[number];

export const SPECIES_FAMILY_VALUE: Record<SpeciesKey, number> = {
  cochon: 100,
  oie: 200,
  mouton: 300,
  chevre: 400,
  ane: 500,
  chien: 650,
  chat: 800,
  cheval: 1000,
  boeuf: 1200,
  vache: 1500,
};
