"use client";

import { useEffect, useState } from "react";
import { Button, Input, PlayerAvatarBadge, Select } from "@kuhhandel/ui";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { loadProfile, type ProfileData } from "../lib/profile";
import { getDefaultNarratorStyle } from "../lib/preferences";
import { Friends } from "./Friends";
import { Profile } from "./Profile";
import { Leaderboards } from "./Leaderboards";
import { Settings } from "./Settings";
import { TopNav, type HubView } from "./TopNav";
import type { LobbyType, NarratorStyle, PublicRoomListing } from "@kuhhandel/shared-types";
import styles from "./Hub.module.css";

const NARRATOR_STYLE_LABELS: Record<NarratorStyle, string> = {
  sport: "Commentateur sportif",
  documentary: "Documentaire animalier",
  western: "Western",
  tv: "Présentateur télé",
};

function ProfileSummaryCard({ profile }: { profile: { id: string; username: string } }) {
  const [data, setData] = useState<ProfileData | null>(null);

  useEffect(() => {
    void loadProfile(profile.id).then(setData);
  }, [profile.id]);

  const activeTitle = data?.titles.find((t) => t.id === data.currentTitleId);

  return (
    <div className={styles.profileCard}>
      <PlayerAvatarBadge name={profile.username} size={88} status="online" />
      <div className={styles.profileName}>{profile.username}</div>
      {activeTitle && <div className={styles.titlePill}>{activeTitle.name}</div>}
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{data ? data.level : "…"}</div>
          <div className={styles.statLabel}>Niveau</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{data ? data.xp : "…"}</div>
          <div className={styles.statLabel}>XP</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{data ? data.badges.length : "…"}</div>
          <div className={styles.statLabel}>Badges</div>
        </div>
      </div>
    </div>
  );
}

export function Hub() {
  const createAndJoin = useGameStore((s) => s.createAndJoin);
  const join = useGameStore((s) => s.join);
  const listPublicRooms = useGameStore((s) => s.listPublicRooms);
  const error = useGameStore((s) => s.error);
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);

  const [view, setView] = useState<HubView>("home");
  const [lobbyType, setLobbyType] = useState<LobbyType>("public");
  const [createPassword, setCreatePassword] = useState("");
  const [narratorStyle, setNarratorStyle] = useState<NarratorStyle>(getDefaultNarratorStyle());
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
    <div className={styles.page}>
      <TopNav active={view} onNavigate={setView} />

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {view === "home" && (
        <div className={styles.grid}>
          <div className={styles.column}>
            <ProfileSummaryCard profile={profile} />

            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Créer une partie</h3>
              <Select
                value={lobbyType}
                onChange={(e) => setLobbyType(e.target.value as LobbyType)}
              >
                <option value="public">Publique</option>
                <option value="private">Privée (par code)</option>
                <option value="password">Protégée par mot de passe</option>
              </Select>
              {lobbyType === "password" && (
                <Input
                  placeholder="Mot de passe du salon"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                />
              )}
              <Select
                value={narratorStyle}
                onChange={(e) => setNarratorStyle(e.target.value as NarratorStyle)}
              >
                {Object.entries(NARRATOR_STYLE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
              <Button
                variant="primary"
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
              </Button>
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Rejoindre avec un code</h3>
              <Input
                placeholder="Code du salon"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
              <Input
                placeholder="Mot de passe (si demandé)"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
              />
              <Button
                variant="secondary"
                onClick={() =>
                  void join(joinCode, profile.username, accessToken, joinPassword || undefined)
                }
              >
                Rejoindre
              </Button>
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Parties publiques</h3>
              <Button
                variant="secondary"
                onClick={() => void listPublicRooms().then(setPublicRooms)}
              >
                Actualiser
              </Button>
              <ul className={styles.roomList}>
                {(publicRooms ?? []).map((r) => (
                  <li key={r.code} className={styles.roomItem}>
                    <span>
                      {r.code} — {r.playerCount} joueur(s) — {r.status}
                    </span>
                    <Button
                      variant="secondary"
                      onClick={() => void join(r.code, profile.username, accessToken)}
                    >
                      Rejoindre
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className={styles.column}>
            <Friends userId={profile.id} />
          </div>
        </div>
      )}

      {view === "profil" && <Profile userId={profile.id} />}
      {view === "classements" && <Leaderboards userId={profile.id} />}
      {view === "parametres" && <Settings />}
    </div>
  );
}
