import type { SpeciesKey } from "@kuhhandel/shared-types";

/**
 * Species keys are lowercase ASCII (`cochon`, `chevre`, `ane`, ...) but the
 * extracted card artwork filenames use capitalized, accented French names
 * (`Cochon`, `Chèvre`, `Âne`, ...) — see `apps/web/app/style-guide/page.tsx`
 * for the source pattern. `boeuf` has no artwork (Phase 1 style guide),
 * so it maps to a slot that intentionally doesn't resolve to a real file,
 * letting `PlayingCard`'s placeholder fallback render instead.
 */
export const SPECIES_IMAGE_SLOT: Record<SpeciesKey, string> = {
  cochon: "animal-Cochon",
  oie: "animal-Oie",
  mouton: "animal-Mouton",
  chevre: "animal-Chèvre",
  ane: "animal-Âne",
  chien: "animal-Chien",
  chat: "animal-Chat",
  cheval: "animal-Cheval",
  boeuf: "animal-missing",
  vache: "animal-Vache",
};

/** Human-readable French labels for species keys — used everywhere a
 * species is rendered as user-facing text (self-hand, opponents' family
 * summary, auction heading, Kuhhandel heading, species picker). */
export const SPECIES_LABEL: Record<SpeciesKey, string> = {
  cochon: "Cochon",
  oie: "Oie",
  mouton: "Mouton",
  chevre: "Chèvre",
  ane: "Âne",
  chien: "Chien",
  chat: "Chat",
  cheval: "Cheval",
  boeuf: "Bœuf",
  vache: "Vache",
};
