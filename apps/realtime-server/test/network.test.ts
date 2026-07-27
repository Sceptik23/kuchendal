import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type {
  ClientToServerEvents,
  GameStateView,
  ServerToClientEvents,
} from "@kuhhandel/shared-types";
import { createSocketServer } from "../src/socketServer.js";
import { RoomManager } from "../src/rooms/RoomManager.js";

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function waitForEvent<T>(socket: TypedClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event as never, resolve as never));
}

/**
 * `state:update` can also fire for unrelated broadcasts racing on the wire
 * (e.g. another player's join arriving late) — wait for the first update
 * matching a predicate instead of assuming the very next event is it.
 */
function waitForState(
  socket: TypedClientSocket,
  predicate: (state: GameStateView) => boolean,
): Promise<GameStateView> {
  return new Promise((resolve) => {
    const handler = (state: GameStateView) => {
      if (predicate(state)) {
        socket.off("state:update", handler);
        resolve(state);
      }
    };
    socket.on("state:update", handler);
  });
}

describe("socket.io wiring — lobby and one full auction turn", () => {
  let httpServer: ReturnType<typeof createServer>;
  let port: number;
  let clients: TypedClientSocket[] = [];

  beforeEach(async () => {
    httpServer = createServer();
    createSocketServer(httpServer, new RoomManager());
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
      transports: ["websocket"],
      forceNew: true,
    });
    clients.push(socket);
    return socket;
  }

  function createRoom(socket: TypedClientSocket): Promise<string> {
    return new Promise((resolve) => socket.emit("lobby:create", { type: "public" }, resolve));
  }

  async function join(socket: TypedClientSocket, code: string, name: string): Promise<string> {
    const result = await new Promise<{ playerId: string } | { error: string }>((resolve) =>
      socket.emit("lobby:join", { code, name }, resolve),
    );
    if ("error" in result) throw new Error(result.error);
    return result.playerId;
  }

  it("lets three clients join, start, and play one auction turn end to end", async () => {
    const s1 = connect();
    const s2 = connect();
    const s3 = connect();

    const code = await createRoom(s1);
    const p1 = await join(s1, code, "p1");
    const p2 = await join(s2, code, "p2");
    const p3 = await join(s3, code, "p3");
    expect(new Set([p1, p2, p3]).size).toBe(3);

    const started = waitForState(s1, (st) => st.status === "in_progress");
    s1.emit("lobby:start");
    const afterStart = await started;
    expect(afterStart.status).toBe("in_progress");
    expect(afterStart.activePlayerId).toBe(p1);

    const afterReveal = waitForState(s2, (st) => st.auction !== null);
    s1.emit("turn:startAuction");
    await afterReveal;

    const afterBid = waitForState(s1, (st) => st.auction?.highestBid?.amount === 10);
    s2.emit("auction:bid", { amount: 10 });
    await afterBid;

    const afterPass = waitForState(s1, (st) => st.auction?.status === "awaiting_seller_decision");
    s3.emit("auction:pass");
    await afterPass;

    const afterResolve = waitForState(s3, (st) => st.activePlayerId === p2);
    s1.emit("auction:sellerDecision", { decision: "sell" });
    const finalState = await afterResolve;

    expect(finalState.deckCount).toBe(39);
    expect(finalState.activePlayerId).toBe(p2);
    expect(finalState.players.find((p) => p.id === p2)!.animals).toHaveLength(1);
  });

  it("rejects an invalid action and reports it only to the acting client", async () => {
    const s1 = connect();
    const s2 = connect();
    const s3 = connect();

    const code = await createRoom(s1);
    await join(s1, code, "p1");
    await join(s2, code, "p2");
    await join(s3, code, "p3");

    s1.emit("lobby:start");
    await waitForEvent(s1, "state:update");

    const error = waitForEvent<{ message: string }>(s2, "error:action");
    // p2 is not the active player and cannot start the auction.
    s2.emit("turn:startAuction");
    const payload = await error;
    expect(payload.message).toBeTruthy();
  });
});
