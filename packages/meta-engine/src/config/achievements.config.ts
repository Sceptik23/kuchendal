import type { CatalogEntry } from "../types.js";

/**
 * v1 sample of hidden achievements (07_META_GAME.md §4). All isSecret:
 * true — never shown to the player before they unlock it.
 */
export const ACHIEVEMENTS: CatalogEntry[] = [
  {
    key: "grand_retournement_manque",
    name: "Grand retournement manqué",
    description: "Perdre une partie alors qu'on était largement en tête au tour précédent.",
    rarity: "rare",
    isSecret: true,
    condition: { type: "lost_after_leading" },
  },
  {
    key: "victoire_sans_marchandage",
    name: "Victoire sans marchandage",
    description: "Gagner une partie sans remporter un seul Kuhhandel.",
    rarity: "rare",
    isSecret: true,
    condition: { type: "won_without_any_kuhhandel_win" },
  },
  {
    key: "dernier_a_la_ferme",
    name: "Dernier à la ferme",
    description: "Être le dernier joueur connecté après la fin d'une partie tardive.",
    rarity: "commun",
    isSecret: true,
    condition: { type: "last_player_connected_after_game" },
  },
  {
    key: "mefiance_totale",
    name: "Méfiance totale",
    description: "Refuser 5 offres de Kuhhandel d'affilée dans une même partie.",
    rarity: "rare",
    isSecret: true,
    condition: { type: "consecutive_kuhhandel_refusals_at_least", count: 5 },
  },
];
