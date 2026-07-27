"use client";

import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { AuthForm } from "../components/AuthForm";
import { JoinForm } from "../components/JoinForm";
import { Lobby } from "../components/Lobby";
import { GameTable } from "../components/GameTable";

export default function HomePage() {
  const initializing = useAuthStore((s) => s.initializing);
  const profile = useAuthStore((s) => s.profile);
  const playerId = useGameStore((s) => s.playerId);
  const state = useGameStore((s) => s.state);

  if (initializing) return null;

  if (!profile) {
    return <AuthForm />;
  }

  if (!playerId || !state) {
    return <JoinForm />;
  }

  if (state.status === "lobby") {
    return <Lobby />;
  }

  return <GameTable />;
}
