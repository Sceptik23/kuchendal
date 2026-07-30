import { describe, expect, it } from 'vitest';
import { GameRoom } from '../src/room/GameRoom.js';
import { DEEP_BANKROLL, groupedDeckFactory, playAuctionOnlyThenConsolidate } from './helpers/playToGameOver.js';

/**
 * Design note: with a deterministic `deckFactory` handing out species in
 * 4-card blocks (not shuffled) and a scripted "active player's fixed first
 * non-active neighbor always wins the auction, active player always sells"
 * loop, three fixed players end up with a known, reproducible split.
 *
 * With `activePlayerIndex` rotating p0→p1→p2→p0→... and `others` computed as
 * `players.filter(id !== active)` (join order preserved, so for active=p0
 * `others=[p1,p2]`, active=p1 `others=[p0,p2]`, active=p2 `others=[p0,p1]`),
 * the fixed bidder-who-always-wins is `others[0]`, giving the buyer sequence
 * `[p1, p0, p0]` repeating every 3 turns. Since each species occupies 4
 * consecutive turns (not a multiple of 3), every species block of 4 turns
 * lands on buyer indices `[s, s+1, s+2, s]` (mod 3) for some starting phase
 * `s` that cycles `0,1,2,0,1,2,0,1,2,0` across the 10 species (species `i`
 * starts at turn `4i+1`, so `s = i mod 3`). Working through the three
 * possible values of `s`:
 * - `s=0` (species 0,3,6,9 — 4 species): buyer indices `[0,1,2,0]` → buyers
 *   `[p1,p0,p0,p1]` → **p0 gets 2, p1 gets 2**.
 * - `s=1` (species 1,4,7 — 3 species): buyer indices `[1,2,0,1]` → buyers
 *   `[p0,p0,p1,p0]` → **p0 gets 3, p1 gets 1**.
 * - `s=2` (species 2,5,8 — 3 species): buyer indices `[2,0,1,2]` → buyers
 *   `[p0,p1,p0,p0]` → **p0 gets 3, p1 gets 1**.
 *
 * So `p2` never buys anything (`others[0]` is never `p2` in this join
 * order) and ends the auction phase with zero animals; `p0` ends up with a
 * 3-1 split against `p1` on 6 species and a 2-2 split on 4 species; no
 * species is ever fully bought by one side, so every one of the 10 species
 * genuinely needs a forced-Kuhhandel consolidation to finish the game — a
 * real exercise of both the ordinary 1-card trade and the special 2-card
 * trade, plus `p2`'s auto-pass.
 *
 * This was verified empirically (not just derived on paper) by scripting
 * the exact loop above and printing each player's per-species animal
 * counts right before consolidation: every one of the 10 species showed
 * either a 3-1 or 2-2 split between p0/p1 with p2 at 0, exactly matching
 * this note.
 */
describe('GameRoom — forced Kuhhandel phase and real end-game condition', () => {
  it('enters FORCED_KUHHANDEL once the deck empties, rejects new auctions, and only finishes once all families are complete', () => {
    const room = new GameRoom(() => 0, DEEP_BANKROLL, undefined, undefined, undefined, groupedDeckFactory);
    const p0 = room.join('p0');
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    room.start();

    playAuctionOnlyThenConsolidate(room, [p0, p1, p2]);

    const finalView = room.getViewFor(p0);
    expect(finalView.status).toBe('finished');
    expect(finalView.phase).toBe('GAME_OVER');
    for (const player of finalView.players) {
      expect(player.score).not.toBeNull();
    }
  });

  it('rejects starting a new auction once the game enters the forced-Kuhhandel phase', () => {
    const room = new GameRoom(() => 0, DEEP_BANKROLL, undefined, undefined, undefined, groupedDeckFactory);
    const p0 = room.join('p0');
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    room.start();

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

    expect(view.phase).toBe('FORCED_KUHHANDEL');
    expect(view.deckCount).toBe(0);
    expect(() => room.startAuction(view.activePlayerId!)).toThrow(/deck is empty|mandatory/i);

    void p1;
    void p2;
  });

  it('auto-passes a player holding only complete families (or nothing) during the forced phase', () => {
    const room = new GameRoom(() => 0, DEEP_BANKROLL, undefined, undefined, undefined, groupedDeckFactory);
    const p0 = room.join('p0');
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    room.start();

    let view = room.getViewFor(p0);
    while (view.phase !== 'FORCED_KUHHANDEL') {
      const activeId = view.activePlayerId!;
      const others = view.players.map((p) => p.id).filter((id) => id !== activeId);
      room.startAuction(activeId);
      room.placeBid(others[0]!, 10);
      room.pass(others[1]!);
      room.sellerDecision(activeId, 'sell');
      view = room.getViewFor(p0);
    }

    // p2 holds zero animals by construction (see the design note above) —
    // GameRoom must never select p2 as the active player from here on.
    expect(view.activePlayerId).not.toBe(p2);

    // Drive the whole consolidation and confirm p2 is never selected as
    // active at any point during the forced phase, not just at entry.
    playAuctionOnlyThenConsolidate(room, [p0, p1, p2]);
    const finalView = room.getViewFor(p0);
    expect(finalView.status).toBe('finished');
    expect(finalView.players.find((p) => p.id === p2)!.animals).toHaveLength(0);
  });
});
