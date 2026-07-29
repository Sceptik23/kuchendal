"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Select } from "@kuhhandel/ui";
import {
  loadLeaderboard,
  type LeaderboardCategory,
  type LeaderboardEntry,
  type LeaderboardScope,
} from "../lib/leaderboard";
import styles from "./Leaderboards.module.css";

const CATEGORY_LABELS: Record<LeaderboardCategory, string> = {
  xp: "XP total",
  wins: "Victoires",
  bluffs: "Bluffs réussis",
  badges: "Badges débloqués",
};

const RANK_COLORS = ["var(--kd-accent-yellow)", "var(--kd-text-muted)", "var(--kd-accent-orange)"];

function rankColor(rank: number): string {
  return RANK_COLORS[rank - 1] ?? "var(--kd-text-subtle)";
}

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
    <div className={styles.shell}>
      <h1 className={styles.title}>Classements</h1>

      <div className={styles.controls}>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value as LeaderboardCategory)}
          className={styles.categorySelect}
        >
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>

        <div className={styles.scopeTabs}>
          {(["global", "friends"] as const).map((scopeValue) => (
            <button
              key={scopeValue}
              className={[styles.scopeTab, scope === scopeValue ? styles.scopeTabActive : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setScope(scopeValue)}
            >
              {scopeValue === "global" ? "Mondial" : "Entre amis"}
            </button>
          ))}
        </div>
      </div>

      {entries === null && <p className={styles.emptyState}>Chargement du classement…</p>}
      {entries !== null && entries.length === 0 && (
        <p className={styles.emptyState}>Aucun joueur classé pour l'instant.</p>
      )}
      {entries !== null && entries.length > 0 && (
        <div className={styles.listContainer}>
          {entries.map((entry, idx) => {
            const rank = idx + 1;
            const color = rankColor(rank);
            const isCurrentUser = entry.userId === userId;
            return (
              <div
                key={entry.userId}
                className={[styles.entry, isCurrentUser ? styles.entryCurrentUser : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  className={styles.rankNumeral}
                  style={{ color } as CSSProperties}
                >
                  {rank}
                </div>
                <div className={styles.userInfo}>
                  <div className={[styles.username, isCurrentUser ? styles.usernameHighlight : ""]
                    .filter(Boolean)
                    .join(" ")}
                  >
                    {entry.username}
                  </div>
                </div>
                <div className={styles.value}>{entry.value}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
