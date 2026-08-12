import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type { ClientToServerEvents, GameStateView, ServerToClientEvents } from "@kuhhandel/shared-types";
import { createSocketServer } from "../src/socketServer.js";
import { RoomManager } from "../src/rooms/RoomManager.js";

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

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

/**
 * Regression coverage for a reported production symptom ("bots stop
 * reacting after I bid", "my raise got silently ignored"): socket.io
 * issues a brand-new socket.id on every reconnect (the client library
 * reconnects automatically after any network blip), but the server only
 * ever mapped playerId -> socket.id for the CONNECTION that ran
 * lobby:join. A socket that reconnects without re-announcing itself is
 * invisible to its room forever after — every future broadcast (including
 * the outcome of its own next action) silently never arrives, and any
 * action it sends fails with "You must join a room before acting", an
 * error the gameplay UI never rendered (only Hub/Lobby did). From the
 * player's seat this reads as the game randomly ignoring their input.
 */
describe("socket.io wiring — reconnect re-registers the session", () => {
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
      transports: ["websocket"],
      forceNew: true,
    });
    clients.push(socket);
    return socket;
  }

  it("a fresh socket.id (simulating a reconnect) is unusable until it re-sends state:resync", async () => {
    const s1 = connect();
    const code = await new Promise<string>((resolve) => s1.emit("lobby:create", { type: "public" }, resolve));
    const p1 = await new Promise<string>((resolve) =>
      s1.emit("lobby:join", { code, name: "human" }, (r) => resolve("playerId" in r ? r.playerId : (r as never))),
    );
    s1.emit("host:addBot");
    await waitForState(s1, (st) => st.players.length === 2);

    // Simulate what happens after a real reconnect: socket.io hands out a
    // brand-new socket.id for the new transport, which the server has never
    // seen before — a second, independent client connection models this
    // more directly (and more reliably in a test) than driving the same
    // client object through disconnect()/connect(). Nothing re-announces
    // the cached {roomCode, playerId} on its own (that's gameStore's job,
    // in its "connect" handler), so this next action must fail exactly
    // like the reported bug until resync is sent.
    s1.close();
    const s1reconnected = connect();

    const staleError = new Promise<{ message: string }>((resolve) =>
      s1reconnected.once("error:action", resolve),
    );
    s1reconnected.emit("host:addBot"); // any action; must fail on the unregistered new socket.id
    const err = await staleError;
    expect(err.message).toMatch(/join a room/i);

    // Now re-announce the session, exactly like gameStore's auto-resync on
    // "connect" does — this must restore full functionality.
    const resynced = waitForState(s1reconnected, (st) => st.players.length === 2);
    s1reconnected.emit("state:resync", { roomCode: code, playerId: p1 });
    await resynced;

    const afterFix = waitForState(s1reconnected, (st) => st.players.length === 3);
    s1reconnected.emit("host:addBot");
    const finalState = await afterFix;
    expect(finalState.players).toHaveLength(3);
  });

  it("state:resync with an unknown/stale session sends lobby:kicked instead of hanging silently", async () => {
    const s1 = connect();
    await new Promise<void>((resolve) => s1.once("connect", () => resolve()));

    const kicked = new Promise<void>((resolve) => s1.once("lobby:kicked", () => resolve()));
    s1.emit("state:resync", { roomCode: "NOPE99", playerId: "player-999" });
    await kicked;
  });
});
