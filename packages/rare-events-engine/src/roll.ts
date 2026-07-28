import type { RandomSource } from "@kuhhandel/game-engine";
import { RARE_EVENTS } from "./config/rareEvents.config.js";
import type { RareEventEntry } from "./types.js";

/** Aggregate chance that *some* rare event fires on a given turn (07_META_GAME.md §6: "probabilité très faible par tour"). */
export const RARE_EVENT_CHANCE_PER_TURN = 0.08;

/**
 * Rolls for a rare event at most once per call: first gates on the overall
 * per-turn chance, then — only if that gate passes — picks one entry from
 * the catalog by weight. Pure and deterministic given `rng`, so callers
 * (GameRoom) can invoke it once per turn without any hidden state here.
 */
export function rollRareEvent(
  rng: RandomSource,
  catalog: RareEventEntry[] = RARE_EVENTS,
  chancePerTurn: number = RARE_EVENT_CHANCE_PER_TURN,
): RareEventEntry | null {
  if (catalog.length === 0) return null;
  if (rng() >= chancePerTurn) return null;

  const totalWeight = catalog.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * totalWeight;
  for (const entry of catalog) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return catalog[catalog.length - 1]!;
}
