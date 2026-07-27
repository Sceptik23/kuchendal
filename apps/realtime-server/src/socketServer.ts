import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kuhhandel/shared-types';
import { GameRoom } from './room/GameRoom.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * The server is the sole source of truth for game state (03_ARCHITECTURE.md
 * §4): every client action is validated by the pure game-engine through
 * GameRoom, and each connected socket only ever receives its own
 * personalized, redacted view — never a single shared broadcast payload
 * that could leak another player's hand or a secret Kuhhandel offer
 * (03_ARCHITECTURE.md §5 and §7).
 */
export function createSocketServer(
  httpServer: HttpServer,
  room: GameRoom = new GameRoom(),
): AppServer {
  const io: AppServer = new Server(httpServer, { cors: { origin: '*' } });
  const playerIdBySocketId = new Map<string, string>();

  function broadcastState(): void {
    for (const [socketId, playerId] of playerIdBySocketId) {
      const socket = io.sockets.sockets.get(socketId);
      socket?.emit('state:update', room.getViewFor(playerId));
    }
  }

  function runAction(socket: AppSocket, action: () => void): void {
    try {
      action();
      broadcastState();
    } catch (error) {
      socket.emit('error:action', {
        message: error instanceof Error ? error.message : 'Unknown error.',
      });
    }
  }

  function requirePlayerId(socket: AppSocket): string {
    const playerId = playerIdBySocketId.get(socket.id);
    if (!playerId) throw new Error('You must join the lobby before acting.');
    return playerId;
  }

  io.on('connection', (socket: AppSocket) => {
    socket.on('lobby:join', (payload, ack) => {
      try {
        const playerId = room.join(payload.name);
        playerIdBySocketId.set(socket.id, playerId);
        ack(playerId);
        broadcastState();
      } catch (error) {
        socket.emit('error:action', {
          message: error instanceof Error ? error.message : 'Unknown error.',
        });
      }
    });

    socket.on('lobby:start', () => {
      runAction(socket, () => room.start());
    });

    socket.on('turn:startAuction', () => {
      runAction(socket, () => room.startAuction(requirePlayerId(socket)));
    });

    socket.on('turn:startKuhhandel', ({ targetId, species }) => {
      runAction(socket, () =>
        room.startKuhhandel(requirePlayerId(socket), targetId, species as never),
      );
    });

    socket.on('auction:bid', ({ amount }) => {
      runAction(socket, () => room.placeBid(requirePlayerId(socket), amount));
    });

    socket.on('auction:pass', () => {
      runAction(socket, () => room.pass(requirePlayerId(socket)));
    });

    socket.on('auction:sellerDecision', ({ decision }) => {
      runAction(socket, () => room.sellerDecision(requirePlayerId(socket), decision));
    });

    socket.on('kuhhandel:submitOffer', ({ moneyCardIds }) => {
      runAction(socket, () => room.submitOffer(requirePlayerId(socket), moneyCardIds));
    });

    socket.on('kuhhandel:accept', () => {
      runAction(socket, () => room.respondAccept(requirePlayerId(socket)));
    });

    socket.on('kuhhandel:counter', ({ moneyCardIds }) => {
      runAction(socket, () => room.respondCounter(requirePlayerId(socket), moneyCardIds));
    });

    socket.on('disconnect', () => {
      playerIdBySocketId.delete(socket.id);
    });
  });

  return io;
}
