/**
 * Re-exports the single-source species data from `@kuhhandel/shared-data`
 * (pure data package, no engine logic) — safe to bundle into the browser
 * without pulling in `@kuhhandel/game-engine`'s auction/kuhhandel/scoring
 * modules. See packages/shared-data/src/species.ts for the values.
 */
export { SPECIES_KEYS, SPECIES_FAMILY_VALUE, type SpeciesKey } from '@kuhhandel/shared-data';
