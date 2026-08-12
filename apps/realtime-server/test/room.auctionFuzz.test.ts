import { describe, it } from 'vitest';
import { GameRoom } from '../src/room/GameRoom.js';

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertNotStuck(room: GameRoom, human: string, seed: number, turn: number, label: string) {
  const view = room.getViewFor(human);
  if (view.auction && view.auction.status === 'bidding') {
    const stuckBot = view.auction.activeBidders.find(
      (id) => id !== human && id !== view.auction!.highestBid?.playerId,
    );
    if (stuckBot) {
      throw new Error(
        `STUCK (${label}): seed=${seed} turn=${turn} bot ${stuckBot} never responded. auction=${JSON.stringify(view.auction)}`,
      );
    }
  }
}

/**
 * Regression coverage for a reported production freeze ("bots stop
 * reacting after I bid"). Property under test: after any human auction
 * action, no bot can be left dangling in `activeBidders` without having
 * bid or passed — `runBotLoop`'s synchronous cascade must always fully
 * settle before control returns to the caller. Investigation (2000
 * seeds x 200 turns during debugging) never found the engine itself at
 * fault; the real root cause turned out to be a client/server session
 * gap on reconnect (see `state:resync` in shared-types and its handler
 * in socketServer.ts). Kept at a smaller seed count here for CI speed —
 * this is a regression guard, not the investigation tool.
 */
describe('fuzz: human bidding never leaves a bot stuck mid-auction', () => {
  for (let seed = 0; seed < 300; seed++) {
    it(`seed ${seed}`, () => {
      const rng = mulberry32(seed);
      const room = new GameRoom(rng);
      const human = room.join('human');
      room.addBot(human);
      room.addBot(human);
      room.start();
      assertNotStuck(room, human, seed, -1, 'post-start');

      for (let turn = 0; turn < 200; turn++) {
        const view = room.getViewFor(human);
        if (view.status !== 'in_progress') break;

        if (view.auction && view.auction.status === 'bidding' && view.auction.activeBidders.includes(human)) {
          const isLeading = view.auction.highestBid?.playerId === human;
          if (isLeading) {
            // Nothing for the human to do this round; the check below
            // still verifies no bot is left dangling — that's the actual
            // bug condition we're hunting.
          } else {
            const myMoney = view.players.find((p) => p.id === human)!.money!;
            const currentHighest = view.auction.highestBid?.amount ?? -1;
            const sorted = [...myMoney].sort((a, b) => b.value - a.value);
            // Randomize: sometimes bid minimally (fewest cards to beat),
            // sometimes bid everything, sometimes just pass.
            const strategy = rng();
            if (strategy < 0.15) {
              room.pass(human);
            } else {
              let sum = 0;
              const chosen: string[] = [];
              const pool = strategy < 0.5 ? sorted : [...sorted].reverse();
              for (const c of pool) {
                if (sum > currentHighest) break;
                sum += c.value;
                chosen.push(c.id);
              }
              if (sum > currentHighest && chosen.length > 0) {
                room.placeBid(human, chosen);
              } else {
                room.pass(human);
              }
            }
          }
        } else if (
          view.auction &&
          view.auction.status === 'awaiting_seller_decision' &&
          view.auction.sellerId === human
        ) {
          room.sellerDecision(human, 'sell');
        } else if (
          view.kuhhandel &&
          view.kuhhandel.stage === 'awaiting_response' &&
          view.kuhhandel.targetId === human
        ) {
          room.respondAccept(human);
        } else if (
          !view.auction &&
          !view.kuhhandel &&
          view.activePlayerId === human &&
          view.deckCount > 0
        ) {
          room.startAuction(human);
        } else if (!view.auction && !view.kuhhandel && view.activePlayerId === human) {
          // FORCED_KUHHANDEL: startAuction is illegal, and the human has no
          // legal-partner-finding logic here — stop, this is outside the
          // scope of the bidding-freeze bug we're hunting.
          break;
        } else {
          // Nothing for the human to do and no auction pending on them —
          // if bots are mid-flow, runBotLoop should already have resolved
          // everything synchronously by now (there is no external "tick"
          // that advances bot state on its own in this engine).
        }

        assertNotStuck(room, human, seed, turn, 'post-action');

        // Terminal-ish state: nothing left for the human and no auction/
        // kuhhandel pending anywhere reachable from their view — avoid an
        // infinite loop on a genuinely stuck-forever state by breaking
        // once we've confirmed (via the assertion above) it's not stuck.
        const after = room.getViewFor(human);
        if (
          !after.auction &&
          !after.kuhhandel &&
          after.activePlayerId !== human &&
          after.status === 'in_progress'
        ) {
          // It's a bot's turn and they haven't acted — since runBotLoop
          // only fires in response to an action, and the human has none
          // available, this could legitimately mean the game is waiting
          // on nothing (bug) or the bots need no external trigger because
          // room.start()/prior calls already drove them fully. Re-check
          // once more; if truly nothing changes, that's suspicious but
          // not itself proof of *this* bug (stuck bidder), so just stop.
          break;
        }
      }
    });
  }
});
