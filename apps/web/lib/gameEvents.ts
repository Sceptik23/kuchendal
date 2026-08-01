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

export interface AnimalTransfer {
  cardId: string;
  species: string;
  fromPlayerId: string;
  toPlayerId: string;
}

export interface MoneyTransfer {
  fromPlayerId: string;
  toPlayerId: string;
  cardCount: number;
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

/** Diffs two consecutive `GameStateView` snapshots and returns every animal
 * card that changed owner — relies solely on `players[].animals`, which is
 * public information (animal ownership is never hidden), so this is safe to
 * compute for any viewer. Backs the seller→buyer transfer-ghost animation. */
export function detectAnimalTransfers(prev: GameStateView | null, next: GameStateView): AnimalTransfer[] {
  if (!prev) return [];
  const transfers: AnimalTransfer[] = [];
  const prevOwner = new Map<string, string>();
  for (const p of prev.players) for (const a of p.animals) prevOwner.set(a.id, p.id);

  for (const p of next.players) {
    for (const a of p.animals) {
      const before = prevOwner.get(a.id);
      if (before && before !== p.id) {
        transfers.push({ cardId: a.id, species: a.species, fromPlayerId: before, toPlayerId: p.id });
      }
    }
  }

  // An auction sale is *not* caught by the ownership diff above: the
  // revealed card is dealt straight from the deck and never appears in any
  // player's `animals` until the moment it's assigned to whoever ends up
  // with it, so it has no "before" owner to diff against. Special-case a
  // just-resolved auction by finding who the card belongs to now and
  // comparing against the seller — if they differ, the sale actually
  // transferred it (a "keep" decision leaves it with the seller, i.e. no
  // transfer to animate).
  //
  // The condition below deliberately checks "the previous auction's card is
  // no longer the current auction" rather than "next.auction is null":
  // when the winning bidder (frequently a bot) immediately reveals another
  // card for auction on their next action, a client that hasn't rendered in
  // between (e.g. a backgrounded tab, or two broadcasts arriving in the same
  // render tick) never observes an intermediate `auction: null` state — it
  // only ever sees `next.auction` already pointing at the *new* card. Gating
  // on `auction === null` alone would silently drop every such sale's animal
  // ghost (verified against a live 3-player game: an auction resolved and a
  // new one started before this effect's next run, and `next.auction` was
  // the new card, not null).
  if (prev.auction && (!next.auction || next.auction.card.id !== prev.auction.card.id)) {
    const { card, sellerId } = prev.auction;
    const newOwner = next.players.find((p) => p.animals.some((a) => a.id === card.id));
    if (newOwner && newOwner.id !== sellerId) {
      transfers.push({ cardId: card.id, species: card.species, fromPlayerId: sellerId, toPlayerId: newOwner.id });
    }
  }

  return transfers;
}

/** Diffs two consecutive `GameStateView` snapshots and returns any single
 * payer→payee money movement, inferred only from `moneyCount` (never the
 * real card values of a player who isn't the viewer) — auctions and
 * Kuhhandel resolutions only ever produce a single-payer/single-payee shape,
 * so anything else is treated as unrepresentable and skipped. */
export function detectMoneyTransfers(prev: GameStateView | null, next: GameStateView): MoneyTransfer[] {
  if (!prev) return [];
  const transfers: MoneyTransfer[] = [];
  const deltas = next.players.map((p) => {
    const before = prev.players.find((pp) => pp.id === p.id)?.moneyCount ?? p.moneyCount;
    return { playerId: p.id, delta: p.moneyCount - before };
  });
  const payers = deltas.filter((d) => d.delta < 0);
  const payees = deltas.filter((d) => d.delta > 0);
  // Single-payer/single-payee is the only shape auctions and Kuhhandel produce.
  if (payers.length === 1 && payees.length === 1) {
    transfers.push({
      fromPlayerId: payers[0]!.playerId,
      toPlayerId: payees[0]!.playerId,
      cardCount: payees[0]!.delta,
    });
  }
  return transfers;
}

/** Diffs two consecutive `GameStateView` snapshots into the persistent
 * event-feed entries (spec §1). Returns events in the order they logically
 * occurred within this single diff (auction, then kuhhandel, then donkey,
 * then family completions) — the caller decides overall feed ordering. */
export function deriveGameEvents(prev: GameStateView | null, next: GameStateView): GameEvent[] {
  if (!prev) return [];
  const events: GameEvent[] = [];

  if (prev.auction && !next.auction) {
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
