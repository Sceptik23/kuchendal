"use client";

import { useGameStore } from "../store/gameStore";
import { getSocket } from "../lib/socket";
import { AuctionPanel } from "./AuctionPanel";
import { KuhhandelInitiator, KuhhandelPanel } from "./KuhhandelPanel";

function familyCounts(animals: { species: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of animals) counts[a.species] = (counts[a.species] ?? 0) + 1;
  return counts;
}

export function GameTable() {
  const state = useGameStore((s) => s.state);
  const playerId = useGameStore((s) => s.playerId);
  if (!state || !playerId) return null;

  const isMyTurn = state.activePlayerId === playerId;
  const noFlowInProgress = !state.auction && !state.kuhhandel;

  if (state.status === "finished") {
    return (
      <div>
        <h2>Partie terminée</h2>
        <ul>
          {[...state.players]
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .map((p) => (
              <li key={p.id}>
                {p.name} — {p.score} points
              </li>
            ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <h2>Table de jeu</h2>
      <p>Pioche restante : {state.deckCount}</p>
      <p>
        Tour de :{" "}
        {state.players.find((p) => p.id === state.activePlayerId)?.name ?? "?"}
        {isMyTurn && " (toi)"}
      </p>

      <ul>
        {state.players.map((p) => (
          <li key={p.id}>
            {p.name} — {p.moneyCount} cartes argent
            {" — animaux : "}
            {Object.entries(familyCounts(p.animals))
              .map(([species, count]) => `${species} x${count}`)
              .join(", ") || "aucun"}
          </li>
        ))}
      </ul>

      {isMyTurn && noFlowInProgress && (
        <div>
          <button onClick={() => getSocket().emit("turn:startAuction")}>
            Révéler une carte (enchère)
          </button>
          <KuhhandelInitiator />
        </div>
      )}

      <AuctionPanel />
      <KuhhandelPanel />
    </div>
  );
}
