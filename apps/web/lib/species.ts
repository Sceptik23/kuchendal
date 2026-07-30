import type { SpeciesKey } from "@kuhhandel/shared-types";

/**
 * Species keys are lowercase ASCII (`cochon`, `chevre`, `ane`, ...) but the
 * extracted card artwork filenames use capitalized, accented French names
 * (`Cochon`, `Chèvre`, `Âne`, ...) — see `apps/web/app/style-guide/page.tsx`
 * for the source pattern. `coq` reuses the `animal-Poule` asset: an earlier
 * design handoff used "Poule" (hen) where the rulebook says "Coq" (rooster)
 * for the same slot/value, so the existing artwork is correct, just
 * relabeled.
 */
export const SPECIES_IMAGE_SLOT: Record<SpeciesKey, string> = {
  coq: "animal-Poule",
  oie: "animal-Oie",
  chat: "animal-Chat",
  chien: "animal-Chien",
  mouton: "animal-Mouton",
  chevre: "animal-Chèvre",
  ane: "animal-Âne",
  cochon: "animal-Cochon",
  vache: "animal-Vache",
  cheval: "animal-Cheval",
};

/** Human-readable French labels for species keys — used everywhere a
 * species is rendered as user-facing text (self-hand, opponents' family
 * summary, auction heading, Kuhhandel heading, species picker). */
export const SPECIES_LABEL: Record<SpeciesKey, string> = {
  coq: "Coq",
  oie: "Oie",
  chat: "Chat",
  chien: "Chien",
  mouton: "Mouton",
  chevre: "Chèvre",
  ane: "Âne",
  cochon: "Cochon",
  vache: "Vache",
  cheval: "Cheval",
};
