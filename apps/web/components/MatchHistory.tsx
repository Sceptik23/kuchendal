"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface HistoryRow {
  final_score: number | null;
  final_rank: number | null;
  games: {
    id: string;
    status: string;
    started_at: string | null;
    finished_at: string | null;
  } | null;
}

export function MatchHistory({ userId }: { userId: string }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("game_players")
      .select("final_score, final_rank, games(id, status, started_at, finished_at)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!cancelled) setRows((data as unknown as HistoryRow[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (rows === null) return <p>Chargement de l'historique…</p>;
  if (rows.length === 0) return <p>Aucune partie jouée pour l'instant.</p>;

  return (
    <ul>
      {rows.map((row, i) => (
        <li key={row.games?.id ?? i}>
          {row.games?.status === "finished"
            ? `Terminée — score ${row.final_score ?? "?"}, rang ${row.final_rank ?? "?"}`
            : `En cours (${row.games?.status})`}
        </li>
      ))}
    </ul>
  );
}
