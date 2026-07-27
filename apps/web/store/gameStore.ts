import { create } from "zustand";
import type { GameStateView } from "@kuhhandel/shared-types";
import { getSocket } from "../lib/socket";

interface GameStore {
  playerId: string | null;
  playerName: string | null;
  state: GameStateView | null;
  error: string | null;
  connected: boolean;
  join: (name: string) => void;
  clearError: () => void;
}

export const useGameStore = create<GameStore>((set) => {
  const socket = getSocket();

  socket.on("connect", () => set({ connected: true }));
  socket.on("disconnect", () => set({ connected: false }));
  socket.on("state:update", (state) => set({ state }));
  socket.on("error:action", (payload) => set({ error: payload.message }));

  return {
    playerId: null,
    playerName: null,
    state: null,
    error: null,
    connected: socket.connected,
    join: (name: string) => {
      socket.emit("lobby:join", { name }, (playerId: string) => {
        set({ playerId, playerName: name });
      });
    },
    clearError: () => set({ error: null }),
  };
});
