import type { CatalogEntry } from "../types.js";

/**
 * v1 sample catalog (07_META_GAME.md §3) — a representative subset, not
 * the full 400+ long-term target. Extending the catalog is adding an entry
 * here, never touching the evaluator in unlocks.ts.
 *
 * Two thresholds ("seuil configurable") are not specified by the doc and
 * are picked here, documented: Millionnaire at score >= 1000 (roughly one
 * complete high-value family), Le Banquier at >= 500 collected in a single
 * game (about one full family's worth of auction proceeds).
 */
export const BADGES: CatalogEntry[] = [
  {
    key: "roi_des_vaches",
    name: "Roi des Vaches",
    description: "Compléter la famille Vache.",
    rarity: "rare",
    isSecret: false,
    condition: { type: "complete_family", species: "vache" },
  },
  {
    key: "le_pigeon",
    name: "Le Pigeon",
    description: "Acheter un animal à au moins 5x sa valeur estimée.",
    rarity: "epique",
    isSecret: false,
    condition: { type: "overpay_ratio_at_least", ratio: 5 },
  },
  {
    key: "escroc_certifie",
    name: "Escroc certifié",
    description: "Faire accepter une offre de Kuhhandel très défavorable à l'adversaire.",
    rarity: "epique",
    isSecret: false,
    condition: { type: "overpay_ratio_at_least", ratio: 5 },
  },
  {
    key: "millionnaire",
    name: "Millionnaire",
    description: "Terminer une partie avec un score élevé.",
    rarity: "rare",
    isSecret: false,
    condition: { type: "score_at_least", score: 1000 },
  },
  {
    key: "faillite",
    name: "Faillite",
    description: "Terminer une partie sans argent.",
    rarity: "commun",
    isSecret: false,
    condition: { type: "ended_with_zero_money" },
  },
  {
    key: "poker_face",
    name: "Poker Face",
    description: "Réussir 10 bluffs d'affilée.",
    rarity: "legendaire",
    isSecret: false,
    condition: { type: "consecutive_successful_bluffs_at_least", count: 10 },
  },
  {
    key: "manipulateur",
    name: "Manipulateur",
    description: "Faire monter une enchère de 3 tours ou plus sans jamais l'emporter.",
    rarity: "rare",
    isSecret: false,
    condition: { type: "bid_rounds_without_winning_at_least", rounds: 3 },
  },
  {
    key: "le_banquier",
    name: "Le Banquier",
    description: "Encaisser un montant cumulé élevé sur une seule partie.",
    rarity: "epique",
    isSecret: false,
    condition: { type: "total_collected_in_game_at_least", amount: 500 },
  },
  {
    key: "sniper",
    name: "Sniper",
    description: "Compléter une famille au tout dernier tour possible.",
    rarity: "epique",
    isSecret: false,
    condition: { type: "completed_family_on_final_turn" },
  },
  {
    key: "demon_des_echanges",
    name: "Démon des échanges",
    description: "Gagner 3 Kuhhandel consécutifs, toutes parties confondues.",
    rarity: "legendaire",
    isSecret: false,
    condition: { type: "kuhhandel_win_streak_at_least", count: 3 },
  },
  {
    key: "collectionneur",
    name: "Collectionneur",
    description: "Compléter au moins 3 familles différentes dans sa carrière.",
    rarity: "rare",
    isSecret: false,
    condition: { type: "distinct_families_career_at_least", count: 3 },
  },
  {
    key: "invaincu",
    name: "Invaincu",
    description: "5 victoires consécutives.",
    rarity: "legendaire",
    isSecret: false,
    condition: { type: "win_streak_at_least", count: 5 },
  },
  {
    key: "maitre_du_bluff",
    name: "Maître du Bluff",
    description: "Au moins 90% de réussite sur au moins 50 bluffs cumulés.",
    rarity: "mythique",
    isSecret: false,
    condition: { type: "successful_bluff_rate_at_least", rate: 0.9, minBluffs: 50 },
  },
  {
    key: "yolo",
    name: "YOLO",
    description: "Miser tout son argent sur une seule offre de Kuhhandel.",
    rarity: "rare",
    isSecret: false,
    condition: { type: "all_in_kuhhandel_offer" },
  },
  {
    key: "legende_du_village",
    name: "Légende du Village",
    description: "Débloquer tous les badges disponibles.",
    rarity: "secret",
    isSecret: true,
    condition: { type: "all_badges_unlocked" },
  },
];
