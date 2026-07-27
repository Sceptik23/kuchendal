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
import { GameRoom } from '../src/room/GameRoom.js';

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
    // auctions to prove the WebSocket-driven game reaches GAME_OVER, not to
    // exercise exact-change bookkeeping (documented game-engine limitation).
    const deepBankroll = () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: `deep-${i}-${Math.random()}`,
        value: 10 as const,
      }));
    createSocketServer(httpServer, new GameRoom(() => 0, deepBankroll));
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

  function join(socket: TypedClientSocket, name: string): Promise<string> {
    return new Promise((resolve) => {
      socket.emit('lobby:join', { name }, (playerId: string) => resolve(playerId));
    });
  }

  it('plays every animal card via raw socket events until GAME_OVER with final scores', async () => {
    const sockets: Record<string, TypedClientSocket> = {};
    const s1 = connect();
    const s2 = connect();
    const s3 = connect();

    const p1 = await join(s1, 'p1');
    const p2 = await join(s2, 'p2');
    const p3 = await join(s3, 'p3');
    sockets[p1] = s1;
    sockets[p2] = s2;
    sockets[p3] = s3;

    s1.emit('lobby:start');
    let state = await waitForState(s1, (st) => st.status === 'in_progress');

    while (state.status === 'in_progress') {
      const activeId = state.activePlayerId!;
      const activeSocket = sockets[activeId]!;
      const others = state.players.map((p) => p.id).filter((id) => id !== activeId);
      const bidderSocket = sockets[others[0]!]!;
      const passerSocket = sockets[others[1]!]!;

      const revealed = waitForState(passerSocket, (st) => st.auction !== null);
      activeSocket.emit('turn:startAuction');
      await revealed;

      const bid = waitForState(activeSocket, (st) => st.auction?.highestBid?.amount === 10);
      bidderSocket.emit('auction:bid', { amount: 10 });
      await bid;

      const passed = waitForState(
        activeSocket,
        (st) => st.auction?.status === 'awaiting_seller_decision',
      );
      passerSocket.emit('auction:pass');
      await passed;

      const nextTurnOrEnd = waitForState(
        activeSocket,
        (st) => st.activePlayerId !== activeId || st.status === 'finished',
      );
      activeSocket.emit('auction:sellerDecision', { decision: 'sell' });
      state = await nextTurnOrEnd;
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
