/**
 * Barème de valeur par espèce (GDD §5, point 1 — ambiguïté tranchée ici).
 * Le jeu physique fait varier ce barème selon les éditions ; valeurs choisies
 * arbitrairement en échelle croissante, à ajuster en playtest.
 * 10 espèces, 4 exemplaires chacune = 40 cartes animaux (GDD §1.1).
 */
export const SPECIES_KEYS = [
  'cochon',
  'oie',
  'mouton',
  'chevre',
  'ane',
  'chien',
  'chat',
  'cheval',
  'boeuf',
  'vache',
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

export const CARDS_PER_SPECIES = 4;
