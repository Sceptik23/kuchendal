import type { GameStateView, SpeciesKey } from "@kuhhandel/shared-types";
import { SPECIES_LABEL } from "./species";

/** 07_AI... N/A here — the known golden-donkey bonus sequence (spec §1),
 * indexed by the reveal count *before* this payout (0 = first payout). */
const DONKEY_BONUS_SEQUENCE = [50, 100, 200, 500];

export type GameEventKind =
  | "auctionResolved"
  | "kuhhandelResolved"
  | "donkeyPayout"
  | "familyCompleted";

export interface GameEvent {
  kind: GameEventKind;
  text: string;
}

export interface FamilyCompletion {
  playerId: string;
  species: SpeciesKey;
}

export function familyCounts(animals: { species: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of animals) counts[a.species] = (counts[a.species] ?? 0) + 1;
  return counts;
}

function playerName(state: GameStateView, playerId: string): string {
  return state.players.find((p) => p.id === playerId)?.name ?? "?";
}

/** Diffs two consecutive `GameStateView` snapshots and returns every
 * newly-completed 4-of-a-kind (spec §1 "Family completed" / §2 shared with
 * the family-complete glow animation — this is the single source of truth
 * both features diff against). */
export function detectFamilyCompletions(
  prev: GameStateView | null,
  next: GameStateView,
): FamilyCompletion[] {
  if (!prev) return [];
  const completions: FamilyCompletion[] = [];

  for (const nextPlayer of next.players) {
    const prevPlayer = prev.players.find((p) => p.id === nextPlayer.id);
    if (!prevPlayer) continue;
    const prevCounts = familyCounts(prevPlayer.animals);
    const nextCounts = familyCounts(nextPlayer.animals);
    for (const [species, count] of Object.entries(nextCounts)) {
      const prevCount = prevCounts[species] ?? 0;
      if (prevCount < 4 && count === 4) {
        completions.push({ playerId: nextPlayer.id, species: species as SpeciesKey });
      }
    }
  }

  return completions;
}

/** Diffs two consecutive `GameStateView` snapshots into the persistent
 * event-feed entries (spec §1). Returns events in the order they logically
 * occurred within this single diff (auction, then kuhhandel, then donkey,
 * then family completions) — the caller decides overall feed ordering. */
export function deriveGameEvents(prev: GameStateView | null, next: GameStateView): GameEvent[] {
  if (!prev) return [];
  const events: GameEvent[] = [];

  if (prev.auction && !next.auction && prev.deckCount !== next.deckCount) {
    const { card, highestBid, sellerId } = prev.auction;
    const speciesLabel = SPECIES_LABEL[card.species];
    if (highestBid) {
      const buyerName = playerName(next, highestBid.playerId);
      events.push({
        kind: "auctionResolved",
        text: `${buyerName} a remporté ${speciesLabel} pour ${highestBid.amount}`,
      });
    } else {
      const sellerName = playerName(next, sellerId);
      events.push({
        kind: "auctionResolved",
        text: `${sellerName} n'a rien payé pour ${speciesLabel}`,
      });
    }
  }

  if (prev.kuhhandel && !next.kuhhandel) {
    const { initiatorId, targetId, species } = prev.kuhhandel;
    events.push({
      kind: "kuhhandelResolved",
      text: `${playerName(next, initiatorId)} et ${playerName(next, targetId)} ont échangé ${SPECIES_LABEL[species]}`,
    });
  }

  if (next.donkeyRevealCount > prev.donkeyRevealCount) {
    for (let i = prev.donkeyRevealCount; i < next.donkeyRevealCount; i++) {
      const amount = DONKEY_BONUS_SEQUENCE[i] ?? DONKEY_BONUS_SEQUENCE[DONKEY_BONUS_SEQUENCE.length - 1]!;
      events.push({
        kind: "donkeyPayout",
        text: `Âne doré : chaque joueur reçoit ${amount}`,
      });
    }
  }

  for (const { playerId, species } of detectFamilyCompletions(prev, next)) {
    events.push({
      kind: "familyCompleted",
      text: `${playerName(next, playerId)} a complété la famille ${SPECIES_LABEL[species]} !`,
    });
  }

  return events;
}
