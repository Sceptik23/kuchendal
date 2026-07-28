"use client";

import { useEffect, useState } from "react";
import {
  loadLeaderboard,
  type LeaderboardCategory,
  type LeaderboardEntry,
  type LeaderboardScope,
} from "../lib/leaderboard";

const CATEGORY_LABELS: Record<LeaderboardCategory, string> = {
  xp: "XP total",
  wins: "Victoires",
  bluffs: "Bluffs réussis",
  badges: "Badges débloqués",
};

export function Leaderboards({ userId }: { userId: string }) {
  const [category, setCategory] = useState<LeaderboardCategory>("xp");
  const [scope, setScope] = useState<LeaderboardScope>("global");
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    void loadLeaderboard(category, scope, userId).then((result) => {
      if (!cancelled) setEntries(result);
    });
    return () => {
      cancelled = true;
    };
  }, [category, scope, userId]);

  return (
    <div>
      <h3>Classements</h3>
      <select value={category} onChange={(e) => setCategory(e.target.value as LeaderboardCategory)}>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <select value={scope} onChange={(e) => setScope(e.target.value as LeaderboardScope)}>
        <option value="global">Mondial</option>
        <option value="friends">Entre amis</option>
      </select>

      {entries === null && <p>Chargement du classement…</p>}
      {entries !== null && entries.length === 0 && <p>Aucun joueur classé pour l'instant.</p>}
      {entries !== null && entries.length > 0 && (
        <ol>
          {entries.map((entry) => (
            <li key={entry.userId}>
              {entry.username}
              {entry.userId === userId && " (toi)"} — {entry.value}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
