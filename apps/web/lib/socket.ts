import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@kuhhandel/shared-types";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/**
 * The client never applies a game rule itself — it only ever sends action
 * intents and renders whatever GameStateView the server broadcasts back
 * (03_ARCHITECTURE.md §4: the server is the sole source of truth).
 */
export function getSocket(): AppSocket {
  if (!socket) {
    const url = process.env["NEXT_PUBLIC_REALTIME_URL"] ?? "http://localhost:4000";
    socket = io(url, { transports: ["websocket"] });
  }
  return socket;
}
