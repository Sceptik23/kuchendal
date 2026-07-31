import { useEffect, useRef, useState } from "react";
import type { GameStateView, SpeciesKey } from "@kuhhandel/shared-types";
import { detectFamilyCompletions } from "../lib/gameEvents";

const PULSE_DURATION_MS = 1300;

export interface FamilyGlow {
  isCompleted(species: SpeciesKey): boolean;
  isJustCompleted(species: SpeciesKey): boolean;
}

/** Tracks, for a single player, which species have a completed 4-of-a-kind
 * (persistent) and which just crossed that threshold this tick (one-shot
 * pulse) — shares `detectFamilyCompletions` with the event feed rather than
 * re-deriving the diff (spec §2). */
export function useFamilyGlow(state: GameStateView | null, playerId: string | null): FamilyGlow {
  const prevStateRef = useRef<GameStateView | null>(null);
  const [pulsing, setPulsing] = useState<Set<SpeciesKey>>(new Set());

  useEffect(() => {
    if (!state || !playerId) return;
    const completions = detectFamilyCompletions(prevStateRef.current, state).filter(
      (c) => c.playerId === playerId,
    );
    prevStateRef.current = state;
    if (completions.length === 0) return;

    setPulsing((prev) => {
      const next = new Set(prev);
      for (const c of completions) next.add(c.species);
      return next;
    });
    const timer = setTimeout(() => {
      setPulsing((prev) => {
        const next = new Set(prev);
        for (const c of completions) next.delete(c.species);
        return next;
      });
    }, PULSE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [state, playerId]);

  const currentPlayer = state?.players.find((p) => p.id === playerId);
  const counts = currentPlayer ? countBySpecies(currentPlayer.animals) : {};

  return {
    isCompleted: (species) => (counts[species] ?? 0) >= 4,
    isJustCompleted: (species) => pulsing.has(species),
  };
}

function countBySpecies(animals: { species: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of animals) counts[a.species] = (counts[a.species] ?? 0) + 1;
  return counts;
}
