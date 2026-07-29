/**
 * Barème de valeur par espèce (GDD §5, point 1). Valeurs et roster tirés
 * du livret de règles officiel Kuhhandel (voir le worked example §4 :
 * 4 cochons + 4 chiens + 4 coqs = 650+160+10 = 820, ×3 familles = 2460).
 * Source de vérité partagée avec le bundle navigateur : voir
 * @kuhhandel/shared-data (packages/shared-data/src/species.ts).
 */
export {
  SPECIES_KEYS,
  SPECIES_FAMILY_VALUE,
  CARDS_PER_SPECIES,
  type SpeciesKey,
} from '@kuhhandel/shared-data';
