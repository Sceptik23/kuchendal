/**
 * Paramètres globaux de partie (GDD §5, points 4-6 — ambiguïtés tranchées ici).
 */

/** Comportement si personne n'enchérit : le vendeur reçoit la carte gratuitement. */
export const NO_BID_SELLER_KEEPS_FREE = true;

/** Fin de partie : quand toutes les familles sont complètes (rulebook §4). Le vidage de la pioche déclenche la phase de marchandage forcé (voir isGameOver / isDeckExhausted dans scoring.ts), pas la fin de partie elle-même. */
export const GAME_END_CONDITION = 'all_families_complete' as const;

/** L'argent restant en main ne compte pas dans le score final. */
export const REMAINING_MONEY_COUNTS_IN_SCORE = false;

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
