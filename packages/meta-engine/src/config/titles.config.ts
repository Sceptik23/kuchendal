import type { TitleEntry } from "../types.js";

/**
 * v1 sample of 12 titles (07_META_GAME.md §5). The doc lists names but no
 * explicit unlock condition per title — this maps each to a level
 * milestone, which is a documented design decision consistent with
 * 02_PRD_PRODUCT.md §5 ("chaque niveau débloque un ou plusieurs éléments
 * cosmétiques : cadre, titre, emote — jamais un niveau creux").
 */
export const TITLES: TitleEntry[] = [
  { key: "le_banquier", name: "Le Banquier", condition: { type: "level_at_least", level: 2 } },
  { key: "le_fermier", name: "Le Fermier", condition: { type: "level_at_least", level: 3 } },
  { key: "le_tricheur", name: "Le Tricheur", condition: { type: "level_at_least", level: 4 } },
  { key: "larnaqueur", name: "L'Arnaqueur", condition: { type: "level_at_least", level: 5 } },
  { key: "le_charognard", name: "Le Charognard", condition: { type: "level_at_least", level: 6 } },
  { key: "le_magnat", name: "Le Magnat", condition: { type: "level_at_least", level: 7 } },
  {
    key: "le_pigeon_royal",
    name: "Le Pigeon Royal",
    condition: { type: "level_at_least", level: 8 },
  },
  {
    key: "lempereur_des_vaches",
    name: "L'Empereur des Vaches",
    condition: { type: "level_at_least", level: 9 },
  },
  {
    key: "le_gourou_du_bluff",
    name: "Le Gourou du Bluff",
    condition: { type: "level_at_least", level: 10 },
  },
  {
    key: "le_collectionneur",
    name: "Le Collectionneur",
    condition: { type: "level_at_least", level: 11 },
  },
  {
    key: "le_roi_du_kuhhandel",
    name: "Le Roi du Kuhhandel",
    condition: { type: "level_at_least", level: 12 },
  },
  {
    key: "le_maitre_des_encheres",
    name: "Le Maître des Enchères",
    condition: { type: "level_at_least", level: 13 },
  },
];
