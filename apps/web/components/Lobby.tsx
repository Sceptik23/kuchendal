"use client";

import { useGameStore } from "../store/gameStore";
import { getSocket } from "../lib/socket";

export function Lobby() {
  const state = useGameStore((s) => s.state);
  const error = useGameStore((s) => s.error);
  if (!state) return null;

  const canStart = state.players.length >= 3;

  return (
    <div>
      <h2>Lobby</h2>
      <ul>
        {state.players.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
      <button disabled={!canStart} onClick={() => getSocket().emit("lobby:start")}>
        Démarrer la partie {!canStart && "(3 joueurs minimum)"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
