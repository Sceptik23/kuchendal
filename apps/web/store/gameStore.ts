import { create } from "zustand";
import type {
  GameStateView,
  LobbyType,
  NarratorStyle,
  PublicRoomListing,
} from "@kuhhandel/shared-types";
import { getSocket } from "../lib/socket";

interface GameStore {
  roomCode: string | null;
  playerId: string | null;
  playerName: string | null;
  state: GameStateView | null;
  error: string | null;
  connected: boolean;
  createAndJoin: (
    type: LobbyType,
    name: string,
    accessToken?: string,
    password?: string,
    narratorStyle?: NarratorStyle,
  ) => Promise<string>;
  join: (code: string, name: string, accessToken?: string, password?: string) => Promise<void>;
  listPublicRooms: () => Promise<PublicRoomListing[]>;
  clearError: () => void;
  /** Local-only reset back to the Hub — there's no server-side "leave"
   * concept to notify (mirrors the `lobby:kicked` handler's `set(...)`). */
  leave: () => void;
}

export const useGameStore = create<GameStore>((set) => {
  const socket = getSocket();

  socket.on("connect", () => set({ connected: true }));
  socket.on("disconnect", () => set({ connected: false }));
  socket.on("state:update", (state) => set({ state }));
  socket.on("error:action", (payload) => set({ error: payload.message }));
  socket.on("lobby:kicked", () => set({ roomCode: null, playerId: null, state: null }));

  function doJoin(
    code: string,
    name: string,
    accessToken?: string,
    password?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.emit(
        "lobby:join",
        { code, name, ...(accessToken ? { accessToken } : {}), ...(password ? { password } : {}) },
        (result) => {
          if ("error" in result) {
            set({ error: result.error });
            reject(new Error(result.error));
            return;
          }
          set({ roomCode: code, playerId: result.playerId, playerName: name });
          resolve();
        },
      );
    });
  }

  return {
    roomCode: null,
    playerId: null,
    playerName: null,
    state: null,
    error: null,
    connected: socket.connected,

    createAndJoin: async (type, name, accessToken, password, narratorStyle) => {
      const code = await new Promise<string>((resolve) => {
        socket.emit(
          "lobby:create",
          {
            type,
            ...(password ? { password } : {}),
            ...(narratorStyle ? { narratorStyle } : {}),
          },
          resolve,
        );
      });
      await doJoin(code, name, accessToken, password);
      return code;
    },

    join: doJoin,

    listPublicRooms: () => new Promise((resolve) => socket.emit("lobby:list", resolve)),

    clearError: () => set({ error: null }),

    leave: () => set({ roomCode: null, playerId: null, state: null }),
  };
});
