"use client";

import { useGameStore } from "../store/gameStore";
import { JoinForm } from "../components/JoinForm";
import { Lobby } from "../components/Lobby";
import { GameTable } from "../components/GameTable";

export default function HomePage() {
  const playerId = useGameStore((s) => s.playerId);
  const state = useGameStore((s) => s.state);

  if (!playerId || !state) {
    return <JoinForm />;
  }

  if (state.status === "lobby") {
    return <Lobby />;
  }

  return <GameTable />;
}
