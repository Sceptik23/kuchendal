/**
 * Distinction keys per 08_AI.md §3. Mapping chosen here (ambiguity in the
 * doc's example list resolved for the code, same spirit as GDD §5):
 * - bluff_annee        -> plus gros bluff réussi
 * - ministre_arnaque    -> plus grosse "arnaque"
 * - pigeon_cosmique     -> plus grosse erreur (achat le plus surpayé)
 * - banquier_dimanche   -> plus gros comeback
 * - meilleur_acteur     -> meilleur acteur
 */
export const DISTINCTION_KEYS = [
  "bluff_annee",
  "ministre_arnaque",
  "pigeon_cosmique",
  "banquier_dimanche",
  "meilleur_acteur",
] as const;
export type DistinctionKey = (typeof DISTINCTION_KEYS)[number];

/**
 * Per-player facts the calculator needs, gathered over the whole game by
 * the caller (apps/realtime-server's GameStatsTracker) from the
 * game_events_log-equivalent play-by-play — this package stays a pure
 * function of these facts, no network/DB access.
 */
export interface PlayerDistinctionFacts {
  playerId: string;
  /** Largest (loser stake - winner stake) across Kuhhandels this player won. */
  maxBluffGap: number;
  /** Largest (perceived species value / winner stake) across Kuhhandels this player won. */
  maxArnaqueRatio: number;
  /** Largest (auction price paid / estimated card value) across auctions this player won. */
  maxOverpayRatio: number;
  /** Mid-game rank minus final rank (positive = climbed the standings). */
  comebackDelta: number;
  kuhhandelWinsCount: number;
  avgKuhhandelWinStake: number;
}

export interface DistinctionEntry {
  playerId: string;
  key: DistinctionKey;
  metricValue: number;
}
