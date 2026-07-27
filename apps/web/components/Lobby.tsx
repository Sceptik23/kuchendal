"use client";

import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { getSocket } from "../lib/socket";
import { InviteQrCode } from "./InviteQrCode";

export function Lobby() {
  const state = useGameStore((s) => s.state);
  const roomCode = useGameStore((s) => s.roomCode);
  const error = useGameStore((s) => s.error);
  const playerId = useGameStore((s) => s.playerId);
  const profile = useAuthStore((s) => s.profile);
  if (!state || !profile) return null;

  const canStart = state.players.length >= 3;
  const isHost = state.hostPlayerId === playerId;
  const inviteUrl =
    typeof window !== "undefined" && roomCode
      ? `${window.location.origin}?join=${roomCode}`
      : "";

  return (
    <div>
      <h2>Lobby {roomCode && `— code ${roomCode}`}</h2>

      {roomCode && (
        <div>
          <p>
            Invite tes amis avec ce lien : <code>{inviteUrl}</code>
          </p>
          <InviteQrCode url={inviteUrl} />
        </div>
      )}

      <ul>
        {state.players.map((p) => (
          <li key={p.id}>
            {p.name}
            {p.id === state.hostPlayerId && " (hôte)"}
            {p.isBot && " (bot)"}
            {isHost && p.id !== playerId && (
              <>
                <button onClick={() => getSocket().emit("host:kick", { playerId: p.id })}>
                  Expulser
                </button>
                <button onClick={() => getSocket().emit("host:transfer", { playerId: p.id })}>
                  Transférer l'hôte
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {isHost && (
        <button onClick={() => getSocket().emit("host:addBot")}>Ajouter un bot</button>
      )}

      <button disabled={!canStart} onClick={() => getSocket().emit("lobby:start")}>
        Démarrer la partie {!canStart && "(3 joueurs minimum)"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
