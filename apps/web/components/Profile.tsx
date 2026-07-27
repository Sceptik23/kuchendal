"use client";

import { useEffect, useState } from "react";
import { loadProfile, setActiveTitle, type ProfileData } from "../lib/profile";

export function Profile({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    void loadProfile(userId).then(setProfile);
  }, [userId]);

  if (!profile) return <p>Chargement du profil…</p>;

  return (
    <div>
      <h3>Profil</h3>
      <p>
        Niveau {profile.level} — {profile.xp} XP
      </p>

      <h4>Titres débloqués</h4>
      <ul>
        {profile.titles.map((t) => (
          <li key={t.id}>
            {t.name}
            {profile.currentTitleId === t.id ? " (actif)" : ""}{" "}
            {profile.currentTitleId !== t.id && (
              <button
                onClick={() =>
                  setActiveTitle(userId, t.id).then(() => loadProfile(userId).then(setProfile))
                }
              >
                Activer
              </button>
            )}
          </li>
        ))}
        {profile.titles.length === 0 && <li>Aucun titre débloqué pour l'instant.</li>}
      </ul>

      <h4>Badges ({profile.badges.length})</h4>
      <ul>
        {profile.badges.map((b) => (
          <li key={b.key} title={b.description}>
            {b.name} <em>({b.rarity})</em>
          </li>
        ))}
        {profile.badges.length === 0 && <li>Aucun badge débloqué pour l'instant.</li>}
      </ul>

      <h4>Succès ({profile.achievements.length})</h4>
      <ul>
        {profile.achievements.map((a) => (
          <li key={a.key} title={a.description}>
            {a.name}
          </li>
        ))}
        {profile.achievements.length === 0 && <li>Aucun succès débloqué pour l'instant.</li>}
      </ul>
    </div>
  );
}
