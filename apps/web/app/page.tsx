"use client";

import { useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { usePresenceStore } from "../store/presenceStore";
import { AuthForm } from "../components/AuthForm";
import { Hub } from "../components/Hub";
import { Lobby } from "../components/Lobby";
import { GameTable } from "../components/GameTable";

export default function HomePage() {
  const initializing = useAuthStore((s) => s.initializing);
  const profile = useAuthStore((s) => s.profile);
  const playerId = useGameStore((s) => s.playerId);
  const state = useGameStore((s) => s.state);
  const startPresence = usePresenceStore((s) => s.start);

  useEffect(() => {
    if (profile) startPresence(profile.id, profile.username);
  }, [profile, startPresence]);

  if (initializing) return null;

  if (!profile) {
    return <AuthForm />;
  }

  if (!playerId || !state) {
    return <Hub />;
  }

  if (state.status === "lobby") {
    return <Lobby />;
  }

  return <GameTable />;
}
