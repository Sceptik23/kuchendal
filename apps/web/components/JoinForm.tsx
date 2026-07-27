"use client";

import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { MatchHistory } from "./MatchHistory";

export function JoinForm() {
  const join = useGameStore((s) => s.join);
  const error = useGameStore((s) => s.error);
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const [showHistory, setShowHistory] = useState(false);

  if (!profile) return null;

  return (
    <div>
      <h1>Kuhhandel Online</h1>
      <p>Connecté en tant que {profile.username}</p>
      <button onClick={() => join(profile.username, session?.access_token)}>
        Rejoindre la partie
      </button>
      <button onClick={() => setShowHistory((v) => !v)}>
        {showHistory ? "Masquer" : "Voir"} mon historique
      </button>
      <button onClick={() => void signOut()}>Se déconnecter</button>
      {error && <p role="alert">{error}</p>}
      {showHistory && <MatchHistory userId={profile.id} />}
    </div>
  );
}
