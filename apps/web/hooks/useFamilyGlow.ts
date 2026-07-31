import { useEffect, useRef, useState } from "react";
import type { GameStateView, SpeciesKey } from "@kuhhandel/shared-types";
import { detectFamilyCompletions, familyCounts } from "../lib/gameEvents";

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
  // Keyed by species so a pending pulse-removal timer's lifetime is tied
  // only to that species re-completing, not to this effect's [state,
  // playerId] deps re-running on every unrelated state broadcast (which
  // would otherwise tear down the cleanup and cancel the pending removal —
  // leaving `pulsing` stuck forever for that species).
  const pulseTimersRef = useRef<Map<SpeciesKey, ReturnType<typeof setTimeout>>>(new Map());

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

    for (const c of completions) {
      const existing = pulseTimersRef.current.get(c.species);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        pulseTimersRef.current.delete(c.species);
        setPulsing((prev) => {
          const next = new Set(prev);
          next.delete(c.species);
          return next;
        });
      }, PULSE_DURATION_MS);
      pulseTimersRef.current.set(c.species, timer);
    }
    // Deliberately no cleanup here — pending per-species timers must
    // survive this effect re-running on the next unrelated state update.
  }, [state, playerId]);

  // Clear any still-pending timers on unmount only.
  useEffect(() => {
    const timers = pulseTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const currentPlayer = state?.players.find((p) => p.id === playerId);
  const counts = currentPlayer ? familyCounts(currentPlayer.animals) : {};

  return {
    isCompleted: (species) => (counts[species] ?? 0) >= 4,
    isJustCompleted: (species) => pulsing.has(species),
  };
}
