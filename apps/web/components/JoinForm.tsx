"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { MatchHistory } from "./MatchHistory";
import { Friends } from "./Friends";
import { Profile } from "./Profile";
import { Leaderboards } from "./Leaderboards";
import type { LobbyType, NarratorStyle, PublicRoomListing } from "@kuhhandel/shared-types";

const NARRATOR_STYLE_LABELS: Record<NarratorStyle, string> = {
  sport: "Commentateur sportif",
  documentary: "Documentaire animalier",
  western: "Western",
  tv: "Présentateur télé",
};

export function JoinForm() {
  const createAndJoin = useGameStore((s) => s.createAndJoin);
  const join = useGameStore((s) => s.join);
  const listPublicRooms = useGameStore((s) => s.listPublicRooms);
  const error = useGameStore((s) => s.error);
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);

  const [showHistory, setShowHistory] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboards, setShowLeaderboards] = useState(false);
  const [lobbyType, setLobbyType] = useState<LobbyType>("public");
  const [createPassword, setCreatePassword] = useState("");
  const [narratorStyle, setNarratorStyle] = useState<NarratorStyle>("sport");
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [publicRooms, setPublicRooms] = useState<PublicRoomListing[] | null>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("join");
    if (fromUrl) setJoinCode(fromUrl.toUpperCase());
  }, []);

  if (!profile) return null;
  const accessToken = session?.access_token;

  return (
    <div>
      <h1>Kuchendal</h1>
      <p>Connecté en tant que {profile.username}</p>

      <section>
        <h3>Créer une partie</h3>
        <select value={lobbyType} onChange={(e) => setLobbyType(e.target.value as LobbyType)}>
          <option value="public">Publique</option>
          <option value="private">Privée (par code)</option>
          <option value="password">Protégée par mot de passe</option>
        </select>
        {lobbyType === "password" && (
          <input
            placeholder="Mot de passe du salon"
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
          />
        )}
        <select
          value={narratorStyle}
          onChange={(e) => setNarratorStyle(e.target.value as NarratorStyle)}
        >
          {Object.entries(NARRATOR_STYLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            createAndJoin(
              lobbyType,
              profile.username,
              accessToken,
              createPassword || undefined,
              narratorStyle,
            )
          }
        >
          Créer
        </button>
      </section>

      <section>
        <h3>Rejoindre avec un code</h3>
        <input
          placeholder="Code du salon"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
        />
        <input
          placeholder="Mot de passe (si demandé)"
          value={joinPassword}
          onChange={(e) => setJoinPassword(e.target.value)}
        />
        <button
          onClick={() =>
            void join(joinCode, profile.username, accessToken, joinPassword || undefined)
          }
        >
          Rejoindre
        </button>
      </section>

      <section>
        <h3>Parties publiques</h3>
        <button onClick={() => void listPublicRooms().then(setPublicRooms)}>Actualiser</button>
        <ul>
          {(publicRooms ?? []).map((r) => (
            <li key={r.code}>
              {r.code} — {r.playerCount} joueur(s) — {r.status}{" "}
              <button onClick={() => void join(r.code, profile.username, accessToken)}>
                Rejoindre
              </button>
            </li>
          ))}
        </ul>
      </section>

      <button onClick={() => setShowHistory((v) => !v)}>
        {showHistory ? "Masquer" : "Voir"} mon historique
      </button>
      <button onClick={() => setShowFriends((v) => !v)}>
        {showFriends ? "Masquer" : "Voir"} mes amis
      </button>
      <button onClick={() => setShowProfile((v) => !v)}>
        {showProfile ? "Masquer" : "Voir"} mon profil
      </button>
      <button onClick={() => setShowLeaderboards((v) => !v)}>
        {showLeaderboards ? "Masquer" : "Voir"} les classements
      </button>
      <button onClick={() => void signOut()}>Se déconnecter</button>

      {error && <p role="alert">{error}</p>}
      {showHistory && <MatchHistory userId={profile.id} />}
      {showFriends && <Friends userId={profile.id} />}
      {showProfile && <Profile userId={profile.id} />}
      {showLeaderboards && <Leaderboards userId={profile.id} />}
    </div>
  );
}
