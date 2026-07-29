/**
 * Paramètres globaux de partie (GDD §5, points 4-6 — ambiguïtés tranchées ici).
 */

/** Comportement si personne n'enchérit : le vendeur reçoit la carte gratuitement. */
export const NO_BID_SELLER_KEEPS_FREE = true;

/** Fin de partie : quand la pioche des 40 cartes animaux est épuisée. */
export const GAME_END_CONDITION = 'deck_exhausted' as const;

/** L'argent restant en main ne compte pas dans le score final. */
export const REMAINING_MONEY_COUNTS_IN_SCORE = false;

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
