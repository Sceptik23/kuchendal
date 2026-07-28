import type { DistinctionEntry, DistinctionKey, PlayerDistinctionFacts } from "./types.js";

interface ScoredCandidate {
  playerId: string;
  value: number;
}

/** Awards a distinction to the highest-scoring candidate strictly above `minValue`, if any. */
function awardTopCandidate(
  candidates: ScoredCandidate[],
  key: DistinctionKey,
  minValue: number,
): DistinctionEntry | null {
  const winner = [...candidates]
    .filter((c) => c.value > minValue)
    .sort((a, b) => b.value - a.value)[0];
  return winner ? { playerId: winner.playerId, key, metricValue: winner.value } : null;
}

/**
 * Computes the end-of-game Hall of Shame/Fame distinctions (08_AI.md §3):
 * at most one entry per distinction key, awarded to whichever player has
 * the most extreme facts for that metric. A metric with no qualifying
 * player (e.g. nobody won a Kuhhandel) simply produces no entry.
 */
export function computeDistinctions(facts: PlayerDistinctionFacts[]): DistinctionEntry[] {
  const entries: DistinctionEntry[] = [];

  const bluffAnnee = awardTopCandidate(
    facts.map((f) => ({ playerId: f.playerId, value: f.maxBluffGap })),
    "bluff_annee",
    0,
  );
  if (bluffAnnee) entries.push(bluffAnnee);

  const ministreArnaque = awardTopCandidate(
    facts.map((f) => ({ playerId: f.playerId, value: f.maxArnaqueRatio })),
    "ministre_arnaque",
    1,
  );
  if (ministreArnaque) entries.push(ministreArnaque);

  const pigeonCosmique = awardTopCandidate(
    facts.map((f) => ({ playerId: f.playerId, value: f.maxOverpayRatio })),
    "pigeon_cosmique",
    1,
  );
  if (pigeonCosmique) entries.push(pigeonCosmique);

  const banquierDimanche = awardTopCandidate(
    facts.map((f) => ({ playerId: f.playerId, value: f.comebackDelta })),
    "banquier_dimanche",
    0,
  );
  if (banquierDimanche) entries.push(banquierDimanche);

  const meilleurActeur = awardTopCandidate(
    facts
      .filter((f) => f.kuhhandelWinsCount > 0)
      .map((f) => ({ playerId: f.playerId, value: f.kuhhandelWinsCount / (f.avgKuhhandelWinStake + 1) })),
    "meilleur_acteur",
    0,
  );
  if (meilleurActeur) entries.push(meilleurActeur);

  return entries;
}
