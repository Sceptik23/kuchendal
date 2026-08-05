import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { SPECIES_KEYS, type AnimalCard } from '@kuhhandel/game-engine';
import type {
  ClientToServerEvents,
  GameStateView,
  ServerToClientEvents,
} from '@kuhhandel/shared-types';
import { createSocketServer } from '../src/socketServer.js';
import { RoomManager } from '../src/rooms/RoomManager.js';
import { findMoneyCardId } from './helpers/playToGameOver.js';

/**
 * Species in 4-card blocks, unshuffled — mirrors
 * `test/helpers/playToGameOver.ts`'s `groupedDeckFactory` so that the
 * deterministic buyer-always-wins auction loop below produces the exact
 * same p0/p1/p2 post-auction split (p2 ends with zero animals; p0 and p1
 * split every species 3-1 or 2-2, p0 always >= p1) that helper's design
 * note proves out at the `GameRoom` level.
 */
function groupedDeckFactory(): AnimalCard[] {
  const cards: AnimalCard[] = [];
  for (const species of SPECIES_KEYS) {
    for (let i = 0; i < 4; i++) cards.push({ id: `${species}-${i}`, species });
  }
  return cards;
}

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function waitForState(
  socket: TypedClientSocket,
  predicate: (state: GameStateView) => boolean,
): Promise<GameStateView> {
  return new Promise((resolve) => {
    const handler = (state: GameStateView) => {
      if (predicate(state)) {
        socket.off('state:update', handler);
        resolve(state);
      }
    };
    socket.on('state:update', handler);
  });
}

/**
 * Phase 2 livrable (09_IMPLEMENTATION_PLAN.md): a complete game, playable
 * end to end over raw WebSocket events, with no graphical UI involved.
 */
describe('scripted full game over WebSocket, no UI', () => {
  let httpServer: ReturnType<typeof createServer>;
  let port: number;
  let clients: TypedClientSocket[] = [];

  beforeEach(async () => {
    httpServer = createServer();
    // Deep single-denomination bankroll: this test drives 40 fixed-amount
    // auctions plus a handful of Kuhhandel consolidation trades to reach the
    // real GAME_OVER condition (all 10 species families complete), not to
    // exercise exact-change bookkeeping (documented game-engine limitation).
    const deepBankroll = (bank: import('@kuhhandel/game-engine').MoneyBank, playerCount: number) => ({
      bank,
      hands: Array.from({ length: playerCount }, (_, p) =>
        Array.from({ length: 60 }, (_, i) => ({
          id: `deep-${p}-${i}-${Math.random()}`,
          value: 10 as const,
        })),
      ),
    });
    createSocketServer(
      httpServer,
      new RoomManager(undefined, () => 0, deepBankroll, groupedDeckFactory),
    );
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as AddressInfo).port;
    clients = [];
  });

  afterEach(async () => {
    for (const client of clients) client.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  function connect(): TypedClientSocket {
    const socket: TypedClientSocket = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
    });
    clients.push(socket);
    return socket;
  }

  function createRoom(socket: TypedClientSocket): Promise<string> {
    return new Promise((resolve) => socket.emit('lobby:create', { type: 'public' }, resolve));
  }

  async function join(socket: TypedClientSocket, code: string, name: string): Promise<string> {
    const result = await new Promise<{ playerId: string } | { error: string }>((resolve) =>
      socket.emit('lobby:join', { code, name }, resolve),
    );
    if ('error' in result) throw new Error(result.error);
    return result.playerId;
  }

  it('plays every animal card via raw socket events until GAME_OVER with final scores', async () => {
    const sockets: Record<string, TypedClientSocket> = {};
    const s1 = connect();
    const s2 = connect();
    const s3 = connect();

    const code = await createRoom(s1);
    const p1 = await join(s1, code, 'p1');
    const p2 = await join(s2, code, 'p2');
    const p3 = await join(s3, code, 'p3');
    sockets[p1] = s1;
    sockets[p2] = s2;
    sockets[p3] = s3;

    s1.emit('lobby:start');
    let state = await waitForState(s1, (st) => st.status === 'in_progress');

    // Phase 1: auctions only, exactly as before, until the deck empties and
    // the room forces everyone into Kuhhandel consolidation
    // (FORCED_KUHHANDEL) — see apps/realtime-server/test/helpers/
    // playToGameOver.ts's design note for why this exact bidder-always-wins
    // auction script deterministically leaves p2 (the 3rd-joined player)
    // with zero animals and splits every species 3-1 or 2-2 between p1/p2
    // (join order), with the earlier-joined side always holding the larger
    // or equal share.
    while (state.status === 'in_progress' && state.phase !== 'FORCED_KUHHANDEL') {
      const activeId = state.activePlayerId!;
      const activeSocket = sockets[activeId]!;
      const others = state.players.map((p) => p.id).filter((id) => id !== activeId);
      const bidderSocket = sockets[others[0]!]!;
      const passerSocket = sockets[others[1]!]!;

      const revealed = waitForState(passerSocket, (st) => st.auction !== null);
      const revealedForBidder = waitForState(bidderSocket, (st) => st.auction !== null);
      activeSocket.emit('turn:startAuction');
      const [, bidderState] = await Promise.all([revealed, revealedForBidder]);

      const bid = waitForState(activeSocket, (st) => st.auction?.highestBid?.amount === 10);
      bidderSocket.emit('auction:bid', { moneyCardIds: [findMoneyCardId(bidderState, others[0]!, 10)] });
      await bid;

      const passed = waitForState(
        activeSocket,
        (st) => st.auction?.status === 'awaiting_seller_decision',
      );
      passerSocket.emit('auction:pass');
      await passed;

      const nextTurnOrEnd = waitForState(
        activeSocket,
        (st) =>
          st.activePlayerId !== activeId ||
          st.status === 'finished' ||
          st.phase === 'FORCED_KUHHANDEL',
      );
      activeSocket.emit('auction:sellerDecision', { decision: 'sell' });
      state = await nextTurnOrEnd;
    }

    // Phase 2: FORCED_KUHHANDEL consolidation. p1 and p2 (join order) hold
    // every animal between them; p3 holds none and is never selected as the
    // active player during this phase. The active player alternates between
    // p1 and p2 as the room walks the incomplete-family list, but
    // `startKuhhandel` requires the *initiator* to be the currently-active
    // player — so whichever of p1/p2 is active must initiate. To always
    // have the same side win every counter-resolution (never a tie), p1 is
    // arranged to always offer/counter with strictly more money than p2,
    // regardless of who initiates a given trade: p1-initiates offers 2
    // money cards (20) against p2's 1-card (10) counter; p2-initiates
    // offers 1 card (10) against p1's 2-card (20) counter. This mirrors
    // playToGameOver.ts's playAuctionOnlyThenConsolidate exactly, just
    // driven over sockets instead of direct GameRoom calls.
    if (state.status !== 'finished') {
      const [p1Id, p2Id] = [p1, p2] as [string, string];

      while (state.status !== 'finished') {
        const activeId = state.activePlayerId!;
        if (activeId !== p1Id && activeId !== p2Id) {
          throw new Error(`Unexpected active player during consolidation: ${activeId}`);
        }

        const p1Player = state.players.find((p) => p.id === p1Id)!;
        const p2Player = state.players.find((p) => p.id === p2Id)!;
        const species = SPECIES_KEYS.find((s) => {
          const p1Count = p1Player.animals.filter((a) => a.species === s).length;
          const p2Count = p2Player.animals.filter((a) => a.species === s).length;
          return p1Count > 0 && p2Count > 0 && p1Count < 4;
        });
        if (!species) break; // nothing left to consolidate; the game must be over

        const initiatorId = activeId;
        const targetId = activeId === p1Id ? p2Id : p1Id;
        const initiatorSocket = sockets[initiatorId]!;
        const targetSocket = sockets[targetId]!;

        // Wait on the initiator's own socket so its personalized view
        // includes its own money cards (each socket only ever sees its own
        // player's `money` array populated — see PlayerView's doc comment).
        const kuhhandelStarted = waitForState(initiatorSocket, (st) => st.kuhhandel !== null);
        initiatorSocket.emit('turn:startKuhhandel', { targetId, species });
        const startedState = await kuhhandelStarted;

        const initiatorMoney = startedState.players.find((p) => p.id === initiatorId)!.money!;

        if (initiatorId === p1Id) {
          // p1 initiates: offer 2 cards (20), p2 counters with 1 (10) — p1 wins.
          const offerAccepted = waitForState(
            targetSocket,
            (st) => st.kuhhandel?.stage === 'awaiting_response',
          );
          initiatorSocket.emit('kuhhandel:submitOffer', {
            moneyCardIds: [initiatorMoney[0]!.id, initiatorMoney[1]!.id],
          });
          const countered = await offerAccepted;
          const targetMoney = countered.players.find((p) => p.id === targetId)!.money!;

          const resolved = waitForState(
            initiatorSocket,
            (st) => st.activePlayerId !== activeId || st.status === 'finished',
          );
          targetSocket.emit('kuhhandel:counter', { moneyCardIds: [targetMoney[0]!.id] });
          state = await resolved;
        } else {
          // p2 initiates: offer 1 card (10), p1 counters with 2 (20) — p1 wins.
          const offerAccepted = waitForState(
            targetSocket,
            (st) => st.kuhhandel?.stage === 'awaiting_response',
          );
          initiatorSocket.emit('kuhhandel:submitOffer', {
            moneyCardIds: [initiatorMoney[0]!.id],
          });
          const countered = await offerAccepted;
          const targetMoney = countered.players.find((p) => p.id === targetId)!.money!;

          const resolved = waitForState(
            initiatorSocket,
            (st) => st.activePlayerId !== activeId || st.status === 'finished',
          );
          targetSocket.emit('kuhhandel:counter', {
            moneyCardIds: [targetMoney[0]!.id, targetMoney[1]!.id],
          });
          state = await resolved;
        }
      }
    }

    expect(state.status).toBe('finished');
    expect(state.deckCount).toBe(0);
    for (const player of state.players) {
      expect(player.score).not.toBeNull();
      expect(player.score).toBeGreaterThanOrEqual(0);
    }
    const totalAnimals = state.players.reduce((sum, p) => sum + p.animals.length, 0);
    expect(totalAnimals).toBe(40);
  }, 20000);
});
