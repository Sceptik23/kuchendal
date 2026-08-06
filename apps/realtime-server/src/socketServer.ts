import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@kuhhandel/shared-types";
import { RoomManager } from "./rooms/RoomManager.js";
import type { GameRoom } from "./room/GameRoom.js";
import { noopVerifier, type UserVerifier } from "./auth/verifyUser.js";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface SocketInfo {
  roomCode: string;
  playerId: string;
}

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
  roomManager: RoomManager = new RoomManager(),
  verifyUser: UserVerifier = noopVerifier,
  /**
   * Defaults to "*" for local dev. In production, set CORS_ORIGIN to the
   * real deployed frontend origin (docs/DEPLOYMENT.md §2) so an unrelated
   * site can't open connections against this game server.
   */
  corsOrigin: string = process.env["CORS_ORIGIN"] ?? "*",
): AppServer {
  const io: AppServer = new Server(httpServer, { cors: { origin: corsOrigin } });
  const socketInfoBySocketId = new Map<string, SocketInfo>();

  function broadcastRoom(roomCode: string, room: GameRoom): void {
    for (const [socketId, info] of socketInfoBySocketId) {
      if (info.roomCode !== roomCode) continue;
      const socket = io.sockets.sockets.get(socketId);
      socket?.emit("state:update", room.getViewFor(info.playerId));
    }
  }

  function emitError(socket: AppSocket, error: unknown): void {
    socket.emit("error:action", {
      message: error instanceof Error ? error.message : "Unknown error.",
    });
  }

  function getInfo(socket: AppSocket): SocketInfo {
    const info = socketInfoBySocketId.get(socket.id);
    if (!info) throw new Error("You must join a room before acting.");
    return info;
  }

  function runAction(socket: AppSocket, action: (room: GameRoom, info: SocketInfo) => void): void {
    try {
      const info = getInfo(socket);
      const room = roomManager.getRoom(info.roomCode);
      if (!room) throw new Error("This room no longer exists.");
      action(room, info);
      broadcastRoom(info.roomCode, room);
    } catch (error) {
      emitError(socket, error);
    }
  }

  io.on("connection", (socket: AppSocket) => {
    socket.on("lobby:create", (payload, ack) => {
      try {
        const { code } = roomManager.createRoom({
          type: payload.type,
          ...(payload.password !== undefined ? { password: payload.password } : {}),
          ...(payload.narratorStyle !== undefined ? { narratorStyle: payload.narratorStyle } : {}),
        });
        ack(code);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on("lobby:list", (ack) => {
      ack(roomManager.listPublicRooms());
    });

    socket.on("lobby:join", (payload, ack) => {
      verifyUser(payload.accessToken)
        .then((userId) => {
          roomManager.authorizeJoin(payload.code, payload.password);
          const room = roomManager.getRoom(payload.code);
          if (!room) throw new Error(`Room not found: ${payload.code}`);

          const playerId = room.join(payload.name, userId);
          socketInfoBySocketId.set(socket.id, { roomCode: payload.code, playerId });
          ack({ playerId });
          broadcastRoom(payload.code, room);
        })
        .catch((error: unknown) => {
          ack({ error: error instanceof Error ? error.message : "Unknown error." });
        });
    });

    socket.on("lobby:start", () => {
      runAction(socket, (room) => room.start());
    });

    socket.on("host:kick", ({ playerId }) => {
      runAction(socket, (room, info) => {
        room.kickPlayer(info.playerId, playerId);
        for (const [socketId, other] of socketInfoBySocketId) {
          if (other.roomCode === info.roomCode && other.playerId === playerId) {
            io.sockets.sockets.get(socketId)?.emit("lobby:kicked");
            socketInfoBySocketId.delete(socketId);
          }
        }
      });
    });

    socket.on("host:transfer", ({ playerId }) => {
      runAction(socket, (room, info) => room.transferHost(info.playerId, playerId));
    });

    socket.on("host:addBot", (payload) => {
      runAction(socket, (room, info) => room.addBot(info.playerId, payload?.difficulty));
    });

    socket.on("turn:startAuction", () => {
      runAction(socket, (room, info) => room.startAuction(info.playerId));
    });

    socket.on("turn:startKuhhandel", ({ targetId, species, cardCount }) => {
      runAction(socket, (room, info) =>
        room.startKuhhandel(info.playerId, targetId, species as never, cardCount),
      );
    });

    socket.on("auction:bid", ({ moneyCardIds }) => {
      runAction(socket, (room, info) => room.placeBid(info.playerId, moneyCardIds));
    });

    socket.on("auction:pass", () => {
      runAction(socket, (room, info) => room.pass(info.playerId));
    });

    socket.on("auction:sellerDecision", ({ decision, paymentCardIds }) => {
      runAction(socket, (room, info) => room.sellerDecision(info.playerId, decision, paymentCardIds));
    });

    socket.on("kuhhandel:submitOffer", ({ moneyCardIds }) => {
      runAction(socket, (room, info) => room.submitOffer(info.playerId, moneyCardIds));
    });

    socket.on("kuhhandel:accept", () => {
      runAction(socket, (room, info) => room.respondAccept(info.playerId));
    });

    socket.on("kuhhandel:counter", ({ moneyCardIds }) => {
      runAction(socket, (room, info) => room.respondCounter(info.playerId, moneyCardIds));
    });

    socket.on("disconnect", () => {
      socketInfoBySocketId.delete(socket.id);
    });
  });

  return io;
}
