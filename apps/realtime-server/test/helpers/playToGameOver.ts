import { GameRoom } from '../../src/room/GameRoom.js';
import { SPECIES_KEYS, type AnimalCard, type MoneyBank } from '@kuhhandel/game-engine';

/** Species in 4-card blocks, unshuffled — see the design note in room.forcedKuhhandel.test.ts for why this exact ordering makes the post-auction p0/p1/p2 split (and thus the Kuhhandel consolidation needed to finish the game) deterministic. */
export function groupedDeckFactory(): AnimalCard[] {
  const cards: AnimalCard[] = [];
  for (const species of SPECIES_KEYS) {
    for (let i = 0; i < 4; i++) cards.push({ id: `${species}-${i}`, species });
  }
  return cards;
}

/**
 * 60 ten-value cards per player: comfortably covers the ~26/14 auction
 * bids p0/p1 place over the 40-turn auction phase (worked out in the
 * design note) plus the up-to-10 consolidation trades below (2 cards
 * spent by p0 and 1 by p1 per trade, well under 60).
 */
export const DEEP_BANKROLL = (bank: MoneyBank, playerCount: number) => ({
  bank,
  hands: Array.from({ length: playerCount }, (_, p) =>
    Array.from({ length: 60 }, (_, i) => ({ id: `deep-${p}-${i}-${Math.random()}`, value: 10 as const })),
  ),
});

/**
 * Drives a 3-player room ['p0','p1','p2'] through the entire auction phase
 * (the deterministic buyer-always-wins loop described in
 * room.forcedKuhhandel.test.ts), then through the forced-Kuhhandel phase to
 * a true GAME_OVER.
 *
 * IMPORTANT DEVIATION FROM THE ORIGINAL BRIEF: `startKuhhandel` requires the
 * *initiator* to be the currently-active player (`requireActivePlayer`), and
 * during FORCED_KUHHANDEL the active player rotates across everyone who
 * still holds an incomplete-family animal — which, per the split described
 * above, is both p0 AND p1 (never p2, who holds nothing). So p0 is not
 * always the active/initiating player here; empirically (see the task-15
 * scratch verification) the active player alternates p1/p0/p1/p0/... once
 * FORCED_KUHHANDEL begins. Rather than always having p0 initiate, this
 * helper lets whichever of p0/p1 is active initiate the trade, but always
 * arranges for p0 to be the higher bidder (offering 20 as initiator, or
 * countering with 20 as target against the other side's fixed 10) so p0
 * always wins the counter-resolution (never a tie) and ends up holding
 * every consolidated animal — consolidating every split species (both the
 * 3-1 and 2-2 splits; the special 2-card trade triggers automatically
 * whenever both sides hold 2, with no special handling needed here).
 */
export function playAuctionOnlyThenConsolidate(room: GameRoom, playerIds: [string, string, string]): void {
  const [p0, p1] = playerIds;
  let view = room.getViewFor(p0);

  while (view.status === 'in_progress' && view.phase !== 'FORCED_KUHHANDEL') {
    const activeId = view.activePlayerId!;
    const others = view.players.map((p) => p.id).filter((id) => id !== activeId);
    room.startAuction(activeId);
    room.placeBid(others[0]!, 10);
    room.pass(others[1]!);
    room.sellerDecision(activeId, 'sell');
    view = room.getViewFor(p0);
  }

  while (view.status === 'in_progress') {
    const activeId = view.activePlayerId!;
    if (activeId !== p0 && activeId !== p1) {
      // p2 holds zero animals by construction (see design note), so it
      // must never be selected as the active player during the forced
      // phase — this guards against a silent infinite loop if that
      // assumption is ever violated by a change elsewhere.
      throw new Error(`Unexpected active player during consolidation: ${activeId}`);
    }

    const p0Animals = room.getViewFor(p0).players.find((p) => p.id === p0)!.animals;
    const p1Animals = room.getViewFor(p0).players.find((p) => p.id === p1)!.animals;
    const species = SPECIES_KEYS.find((s) => {
      const p0Count = p0Animals.filter((a) => a.species === s).length;
      const p1Count = p1Animals.filter((a) => a.species === s).length;
      return p0Count > 0 && p1Count > 0 && p0Count < 4;
    });
    if (!species) break; // nothing left to consolidate; the game must be over

    if (activeId === p0) {
      room.startKuhhandel(p0, p1, species);
      const p0Money = room.getViewFor(p0).players.find((p) => p.id === p0)!.money!;
      room.submitOffer(p0, [p0Money[0]!.id, p0Money[1]!.id]); // 20 — initiator's offer

      const p1Money = room.getViewFor(p1).players.find((p) => p.id === p1)!.money!;
      room.respondCounter(p1, [p1Money[0]!.id]); // 10 — loses to p0's 20 as initiator, never a tie
    } else {
      room.startKuhhandel(p1, p0, species);
      const p1Money = room.getViewFor(p1).players.find((p) => p.id === p1)!.money!;
      room.submitOffer(p1, [p1Money[0]!.id]); // 10 — initiator's offer

      const p0Money = room.getViewFor(p0).players.find((p) => p.id === p0)!.money!;
      room.respondCounter(p0, [p0Money[0]!.id, p0Money[1]!.id]); // 20 — beats p1's 10 as target, never a tie
    }

    view = room.getViewFor(p0);
  }
}
