import { useEffect, useRef, useState } from "react";
import type { GameStateView } from "@kuhhandel/shared-types";
import type { EventFeedEntry } from "@kuhhandel/ui";
import { deriveGameEvents } from "../lib/gameEvents";

const EVENT_FEED_LIMIT = 50;

/** Diffs each incoming `state` against the previous one and accumulates a
 * capped, newest-first feed (spec §1) — the durable complement to the
 * existing single-message `ToastNarrator`, which this hook does not touch. */
export function useEventFeed(state: GameStateView | null): EventFeedEntry[] {
  const prevStateRef = useRef<GameStateView | null>(null);
  const seqRef = useRef(0);
  const [entries, setEntries] = useState<EventFeedEntry[]>([]);

  useEffect(() => {
    if (!state) return;
    const newEvents = deriveGameEvents(prevStateRef.current, state);
    prevStateRef.current = state;
    if (newEvents.length === 0) return;

    setEntries((prev) => {
      const withIds = newEvents.map((event) => ({
        id: `${seqRef.current++}`,
        text: event.text,
      }));
      return [...withIds.reverse(), ...prev].slice(0, EVENT_FEED_LIMIT);
    });
  }, [state]);

  return entries;
}
