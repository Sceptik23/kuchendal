import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  GameStateView,
  ServerToClientEvents,
} from '@kuhhandel/shared-types';
import { createSocketServer } from '../src/socketServer.js';
import { RoomManager } from '../src/rooms/RoomManager.js';
import { findMoneyCardId } from './helpers/playToGameOver.js';

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
 * 03_ARCHITECTURE.md §5: a Kuhhandel secret offer must never transit in the
 * raw network payload to a client not entitled to see it, even hidden
 * behind UI — not just "the UI happens not to render it". This test
 * inspects every raw payload actually delivered to non-authorized sockets
 * (via onAny, bypassing any client-side interpretation) and asserts the
 * secret offer's identifying data is nowhere in them.
 */
describe("critical: Kuhhandel secret offer never reaches an unauthorized client's raw payload", () => {
  let httpServer: ReturnType<typeof createServer>;
  let port: number;
  let clients: TypedClientSocket[] = [];

  beforeEach(async () => {
    httpServer = createServer();
    createSocketServer(httpServer, new RoomManager(undefined, () => 0));
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

  it('hides the secret offer from the target and from a bystander before reveal', async () => {
    const s1 = connect();
    const s2 = connect();
    const s3 = connect();

    const code = await createRoom(s1);
    await join(s1, code, 'p1');
    const p2 = await join(s2, code, 'p2');
    const p3 = await join(s3, code, 'p3');

    s1.emit('lobby:start');
    await waitForState(s1, (st) => st.status === 'in_progress');

    // Deck order for rng=()=>0 starts with three "coq" cards in a row:
    // two quick auctions give p2 and p3 each one, making a Kuhhandel between
    // them legal on turn 3 (cf. room.test.ts for the derivation).
    s1.emit('turn:startAuction');
    const revealedForS2 = await waitForState(s2, (st) => st.auction !== null);
    s2.emit('auction:bid', { moneyCardIds: [findMoneyCardId(revealedForS2, p2, 10)] });
    await waitForState(s1, (st) => st.auction?.highestBid?.amount === 10);
    s3.emit('auction:pass');
    await waitForState(s1, (st) => st.auction?.status === 'awaiting_seller_decision');
    s1.emit('auction:sellerDecision', { decision: 'sell' });
    await waitForState(s3, (st) => st.activePlayerId === p2);

    s2.emit('turn:startAuction');
    const revealedForS3 = await waitForState(s3, (st) => st.auction !== null);
    s3.emit('auction:bid', { moneyCardIds: [findMoneyCardId(revealedForS3, p3, 10)] });
    await waitForState(s2, (st) => st.auction?.highestBid?.amount === 10);
    s1.emit('auction:pass');
    await waitForState(s2, (st) => st.auction?.status === 'awaiting_seller_decision');
    s2.emit('auction:sellerDecision', { decision: 'sell' });
    await waitForState(s1, (st) => st.activePlayerId === p3);

    // From here on, capture every raw payload delivered to the target (p2)
    // and to a bystander (p1) — before any secret offer is submitted.
    const rawPayloadsToTarget: unknown[] = [];
    const rawPayloadsToBystander: unknown[] = [];
    s2.onAny((_event, ...args) => rawPayloadsToTarget.push(...args));
    s1.onAny((_event, ...args) => rawPayloadsToBystander.push(...args));

    // p3 must know their own card ids to submit a real offer — fetch p3's
    // own private view (its money array is only ever sent to p3 itself) from
    // the single state:update this action triggers.
    const p3ViewPromise = waitForState(s3, (st) => st.kuhhandel?.initiatorId === p3);
    const targetSeesKuhhandel = waitForState(s2, (st) => st.kuhhandel !== null);
    s3.emit('turn:startKuhhandel', { targetId: p2, species: 'coq' });
    const [p3View] = await Promise.all([p3ViewPromise, targetSeesKuhhandel]);
    const offeredCardId = p3View.players.find((p) => p.id === p3)!.money![0]!.id;

    const offerSubmitted = waitForState(s2, (st) => st.kuhhandel?.stage === 'awaiting_response');
    s3.emit('kuhhandel:submitOffer', { moneyCardIds: [offeredCardId] });
    await offerSubmitted;

    // Give any in-flight events a moment to arrive before inspecting captures.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const serializedTarget = JSON.stringify(rawPayloadsToTarget);
    const serializedBystander = JSON.stringify(rawPayloadsToBystander);

    expect(serializedTarget).not.toContain(offeredCardId);
    expect(serializedBystander).not.toContain(offeredCardId);

    const targetKuhhandelViews = rawPayloadsToTarget.filter(
      (p): p is GameStateView =>
        typeof p === 'object' && p !== null && (p as GameStateView).kuhhandel != null,
    );
    expect(targetKuhhandelViews.length).toBeGreaterThan(0);
    for (const view of targetKuhhandelViews) {
      expect(view.kuhhandel?.initiatorOffer).toBeNull();
    }
  });
});
