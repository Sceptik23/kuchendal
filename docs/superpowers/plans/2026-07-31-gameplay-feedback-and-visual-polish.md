# Gameplay Feedback & Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give players a persistent event feed, card-reveal/family-complete/money/animal transfer animations, and a fixed per-species color identity, per `docs/superpowers/specs/2026-07-31-gameplay-feedback-and-visual-polish-design.md`.

**Architecture:** Everything except one additive server field lives in `apps/web` (event derivation, hooks, page wiring) and `packages/ui` (presentational `EventFeed`, animation-capable `PlayingCard`, a small FLIP-based `TransferGhost` overlay). Events and family completions are derived client-side by diffing consecutive `GameStateView` snapshots — no new wire messages except `donkeyRevealCount`.

**Tech Stack:** Next.js 15 / React 19 (`apps/web`), a framework-agnostic React component package (`packages/ui`), plain CSS (CSS Modules + custom properties, no animation library), Zustand store already wired to socket.io, Fastify/socket.io realtime server (`apps/realtime-server`) with Vitest.

## Global Constraints

- **No engine/realtime-server logic changes** beyond exposing `donkeyRevealCount` on `GameStateView` — every other event is derivable client-side from data already on the wire (spec Non-goals).
- **No animation library dependency** — CSS `@keyframes`/transitions only; `packages/ui/src/tokens.css`'s existing sitewide `prefers-reduced-motion` override (lines 75-88) already disables all animation/transition durations globally, so no per-animation opt-out is needed.
- **No layout/navigation redesign** — additive changes to existing panels (`GameTable.tsx`, `AuctionPanel.tsx`, `KuhhandelPanel.tsx`), same `768px` mobile breakpoint already used throughout `GameTable.module.css`.
- **`apps/web` and `packages/ui` have no test runner wired up** — both packages' `test` script is a stub (`echo "no tests yet" && exit 0`); the spec's own Testing section says verification here is manual (play a full game through the browser). Do **not** bootstrap Vitest into either package for this feature — that's explicit scope creep the spec calls out as a non-goal. Every `apps/web`/`packages/ui` task ends with `pnpm --filter <pkg> typecheck` instead of a test run; the final task is a manual browser playthrough covering every event/animation/color.
- **`apps/realtime-server` and `packages/game-engine` do have real Vitest suites** (`vitest run`) — the one server-side change (Task 1) follows normal TDD there.
- Money cards (`variant="money"`) never adopt species colors — species color only applies to `variant="animal"` cards (spec §3).
- Every animal-card render site currently in the codebase is `apps/web/components/GameTable.tsx` (auction stage card, line ~275; self-hand cards, line ~327) — `AuctionPanel.tsx` and `KuhhandelPanel.tsx` today only render `variant="money"` cards, so there is nothing to "switch" there yet; new animal-card renders this plan introduces (transfer-animation ghosts) must use `SPECIES_COLOR` from the start rather than a hardcoded accent.
- Opponents' exact money is never sent to the client except as a count (`PlayerView.moneyCount`) — any money-transfer visualization for a transfer the viewer isn't a party to must not imply knowledge of exact bill values it doesn't have (existing invariant, `GameTable.tsx:230-236`).

---

### Task 1: Expose `donkeyRevealCount` on `GameStateView`

**Files:**
- Modify: `packages/shared-types/src/index.ts` (the `GameStateView` interface, lines 38-51)
- Modify: `apps/realtime-server/src/room/GameRoom.ts` (`getViewFor`, lines 634-658)
- Test: `apps/realtime-server/test/room.sixPlayers.test.ts`

**Interfaces:**
- Produces: `GameStateView.donkeyRevealCount: number` — consumed by Task 3's `deriveGameEvents`.

- [ ] **Step 1: Write the failing assertion**

Add to the existing golden-donkey test in `apps/realtime-server/test/room.sixPlayers.test.ts` (the `it('survives all four golden donkey payouts...')` block, lines 74-96) — track the count across the loop and assert it after each reveal:

```ts
  it('survives all four golden donkey payouts at 6 players without wedging the room', () => {
    const room = new GameRoom(() => 0, undefined, undefined, undefined, undefined, donkeyFirstDeckFactory);
    const ids = joinSix(room);
    room.start();

    expect(room.getViewFor(ids[0]!).donkeyRevealCount).toBe(0);

    // Four consecutive ânes: 6 players × 4 reveals = 24 bonus draws on top of
    // the 42 starting cards, well past the box's 55-card supply.
    for (let reveal = 0; reveal < 4; reveal++) {
      const active = room.getViewFor(ids[0]!).activePlayerId;
      expect(() => room.startAuction(active)).not.toThrow();
      // Everyone but the seller passes, so the seller keeps the card.
      for (const id of ids) {
        if (id !== active) room.pass(id);
      }
      expect(() => room.sellerDecision(active, 'keep')).not.toThrow();
      expect(room.getViewFor(ids[0]!).donkeyRevealCount).toBe(reveal + 1);
    }

    for (const id of ids) {
      const own = room.getViewFor(id).players.find((p) => p.id === id)!;
      expect(own.money!.length).toBeGreaterThan(0);
    }
    expect(room.getSummary().status).toBe('in_progress');
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @kuhhandel/realtime-server test -- room.sixPlayers`
Expected: FAIL — `donkeyRevealCount` does not exist on the type returned by `getViewFor` (TS error) or is `undefined` at runtime.

- [ ] **Step 3: Add the field to the wire type**

`packages/shared-types/src/index.ts` — add to `GameStateView` (after `rareEventsFeed`):

```ts
export interface GameStateView {
  status: RoomStatus;
  phase: GamePhase;
  players: PlayerView[];
  activePlayerId: string | null;
  hostPlayerId: string | null;
  deckCount: number;
  auction: AuctionState | null;
  kuhhandel: KuhhandelPublicView | null;
  /** Recent narrator comments (08_AI.md §1), most recent last. */
  narratorFeed: NarratorMessage[];
  /** Hall of Shame/Fame distinctions (08_AI.md §3) — only populated once the game has finished. */
  distinctions: DistinctionEntry[];
  /** Recent rare events (07_META_GAME.md §6) — cosmetic only, never affects scoring. */
  rareEventsFeed: RareEventEntry[];
  /** How many golden donkeys have been revealed so far — increments the
   * known 50/100/200/500 bonus sequence (client derives the payout amount
   * from this count, not from a duplicated wire field). */
  donkeyRevealCount: number;
}
```

- [ ] **Step 4: Expose it from `getViewFor`**

`apps/realtime-server/src/room/GameRoom.ts` — add `donkeyRevealCount: this.donkeyRevealCount,` to the object returned by `getViewFor` (lines 634-658):

```ts
  getViewFor(viewerId: string): GameStateView {
    const players: PlayerView[] = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      animals: p.animals,
      moneyCount: p.money.length,
      money: p.id === viewerId ? p.money : null,
      score: this.status === 'finished' ? computeScore(p) : null,
      isBot: this.botPlayerIds.has(p.id),
    }));

    return {
      status: this.status,
      phase: this.phase,
      players,
      activePlayerId: this.status === 'in_progress' ? this.activePlayer.id : null,
      hostPlayerId: this.hostPlayerId,
      deckCount: this.deck.length,
      auction: this.auction,
      kuhhandel: this.kuhhandel ? getKuhhandelPublicView(this.kuhhandel, viewerId) : null,
      narratorFeed: this.narratorFeed,
      distinctions: this.status === 'finished' ? this.finalDistinctions : [],
      rareEventsFeed: this.rareEventsFeed,
      donkeyRevealCount: this.donkeyRevealCount,
    };
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @kuhhandel/realtime-server test -- room.sixPlayers`
Expected: PASS

- [ ] **Step 6: Run the full realtime-server suite and typecheck**

Run: `pnpm --filter @kuhhandel/realtime-server test && pnpm --filter @kuhhandel/shared-types typecheck && pnpm --filter @kuhhandel/realtime-server typecheck`
Expected: all PASS — a newly-required field on `GameStateView` can surface unrelated compile errors anywhere `GameStateView` is constructed by hand (e.g. other test fixtures); fix any that appear by adding `donkeyRevealCount: 0` (or the appropriate value) to those fixtures.

- [ ] **Step 7: Commit**

```bash
git add packages/shared-types/src/index.ts apps/realtime-server/src/room/GameRoom.ts apps/realtime-server/test/room.sixPlayers.test.ts
git commit -m "feat(realtime-server): expose donkeyRevealCount on GameStateView"
```

---

### Task 2: Per-species color tokens and `SPECIES_COLOR` map

**Files:**
- Modify: `packages/ui/src/tokens.css`
- Create: `apps/web/lib/species.ts` addition (modify existing file)
- Modify: `apps/web/components/GameTable.tsx` (the two `variant="animal"` call sites)

**Interfaces:**
- Produces: `SPECIES_COLOR: Record<SpeciesKey, string>` from `apps/web/lib/species.ts` — consumed by every task that renders a `variant="animal"` `PlayingCard` (Task 6, 7, 9).

- [ ] **Step 1: Add the 5 new species CSS custom properties**

`packages/ui/src/tokens.css` — add after the existing `--kd-accent-*` block (after line 30, before the rarity-frame block), matching the file's existing comment style:

```css
  /* Species identity colors — unlike --kd-accent-*, all 10 are active
     simultaneously wherever animal cards render (hand, auction, Kuhhandel
     panel), so they're a separate token family. 5 reuse existing
     --kd-accent-* values (coq, oie, chat, chien, ane); these 5 are new. */
  --kd-species-mouton: oklch(72% 0.24 20);
  --kd-species-chevre: oklch(85% 0.22 70);
  --kd-species-cochon: oklch(68% 0.25 300);
  --kd-species-vache: oklch(68% 0.22 260);
  --kd-species-cheval: oklch(75% 0.20 170);
```

- [ ] **Step 2: Add `SPECIES_COLOR` to `apps/web/lib/species.ts`**

Append to the existing file (after `SPECIES_LABEL`):

```ts
/** Fixed per-species color identity (spec: gameplay-feedback-and-visual-polish
 * §3) — used everywhere a `variant="animal"` PlayingCard renders, replacing
 * the old per-context accentColor. 5 reuse existing --kd-accent-* tokens, 5
 * use the new --kd-species-* tokens in tokens.css. */
export const SPECIES_COLOR: Record<SpeciesKey, string> = {
  coq: "var(--kd-accent-orange)",
  oie: "var(--kd-accent-yellow)",
  chat: "var(--kd-accent-pink)",
  chien: "var(--kd-accent-cyan)",
  mouton: "var(--kd-species-mouton)",
  chevre: "var(--kd-species-chevre)",
  ane: "var(--kd-accent-green)",
  cochon: "var(--kd-species-cochon)",
  vache: "var(--kd-species-vache)",
  cheval: "var(--kd-species-cheval)",
};
```

- [ ] **Step 3: Switch `GameTable.tsx`'s two animal-card call sites**

`apps/web/components/GameTable.tsx` — import `SPECIES_COLOR` alongside the existing `species` import (line 16):

```ts
import { SPECIES_COLOR, SPECIES_IMAGE_SLOT, SPECIES_LABEL } from "../lib/species";
```

Auction stage card (lines 275-281) — replace the hardcoded accent:

```tsx
                <PlayingCard
                  variant="animal"
                  label={SPECIES_LABEL[state.auction.card.species]}
                  value={SPECIES_FAMILY_VALUE[state.auction.card.species]}
                  imageSlot={SPECIES_IMAGE_SLOT[state.auction.card.species]}
                  accentColor={SPECIES_COLOR[state.auction.card.species]}
                />
```

Self-hand cards (lines 325-335) — replace the rotating-accent lookup (the `i`-based `OPPONENT_ACCENTS` index is no longer needed for animal cards; `OPPONENT_ACCENTS` stays as-is for opponents/hall-of-fame, which are unrelated to species):

```tsx
            {currentPlayer.animals.map((a) => (
              <div key={a.id} className={styles.selfHandCard}>
                <PlayingCard
                  variant="animal"
                  label={SPECIES_LABEL[a.species]}
                  value={SPECIES_FAMILY_VALUE[a.species]}
                  imageSlot={SPECIES_IMAGE_SLOT[a.species]}
                  accentColor={SPECIES_COLOR[a.species]}
                />
              </div>
            ))}
```

(Dropping the now-unused `i` parameter from this `.map` callback.)

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/ui typecheck`
Expected: PASS, no unused-variable lint errors from the dropped `i` parameter (run `pnpm --filter @kuhhandel/web lint` too and fix any).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/tokens.css apps/web/lib/species.ts apps/web/components/GameTable.tsx
git commit -m "feat(web): fixed per-species card color identity"
```

---

### Task 3: Client-side event & family-completion derivation

**Files:**
- Create: `apps/web/lib/gameEvents.ts`

**Interfaces:**
- Consumes: `GameStateView` (`@kuhhandel/shared-types`), `SPECIES_LABEL` (`apps/web/lib/species.ts`).
- Produces: `GameEventKind`, `GameEvent { kind: GameEventKind; text: string }`, `deriveGameEvents(prev: GameStateView | null, next: GameStateView): GameEvent[]`, `FamilyCompletion { playerId: string; species: SpeciesKey }`, `detectFamilyCompletions(prev: GameStateView | null, next: GameStateView): FamilyCompletion[]`, `familyCounts(animals: { species: string }[]): Record<string, number>` — consumed by Task 5 (`useEventFeed`) and Task 7 (`useFamilyGlow`). `GameTable.tsx`'s existing local `familyCounts` (lines 32-36) is removed and replaced by this import (no duplicated logic, per spec's explicit "share the diffing logic, don't duplicate it").

- [ ] **Step 1: Write `apps/web/lib/gameEvents.ts`**

```ts
import type { GameStateView, SpeciesKey } from "@kuhhandel/shared-types";
import { SPECIES_LABEL } from "./species";

/** 07_AI... N/A here — the known golden-donkey bonus sequence (spec §1),
 * indexed by the reveal count *before* this payout (0 = first payout). */
const DONKEY_BONUS_SEQUENCE = [50, 100, 200, 500];

export type GameEventKind =
  | "auctionResolved"
  | "kuhhandelResolved"
  | "donkeyPayout"
  | "familyCompleted";

export interface GameEvent {
  kind: GameEventKind;
  text: string;
}

export interface FamilyCompletion {
  playerId: string;
  species: SpeciesKey;
}

export function familyCounts(animals: { species: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of animals) counts[a.species] = (counts[a.species] ?? 0) + 1;
  return counts;
}

function playerName(state: GameStateView, playerId: string): string {
  return state.players.find((p) => p.id === playerId)?.name ?? "?";
}

/** Diffs two consecutive `GameStateView` snapshots and returns every
 * newly-completed 4-of-a-kind (spec §1 "Family completed" / §2 shared with
 * the family-complete glow animation — this is the single source of truth
 * both features diff against). */
export function detectFamilyCompletions(
  prev: GameStateView | null,
  next: GameStateView,
): FamilyCompletion[] {
  if (!prev) return [];
  const completions: FamilyCompletion[] = [];

  for (const nextPlayer of next.players) {
    const prevPlayer = prev.players.find((p) => p.id === nextPlayer.id);
    if (!prevPlayer) continue;
    const prevCounts = familyCounts(prevPlayer.animals);
    const nextCounts = familyCounts(nextPlayer.animals);
    for (const [species, count] of Object.entries(nextCounts)) {
      const prevCount = prevCounts[species] ?? 0;
      if (prevCount < 4 && count === 4) {
        completions.push({ playerId: nextPlayer.id, species: species as SpeciesKey });
      }
    }
  }

  return completions;
}

/** Diffs two consecutive `GameStateView` snapshots into the persistent
 * event-feed entries (spec §1). Returns events in the order they logically
 * occurred within this single diff (auction, then kuhhandel, then donkey,
 * then family completions) — the caller decides overall feed ordering. */
export function deriveGameEvents(prev: GameStateView | null, next: GameStateView): GameEvent[] {
  if (!prev) return [];
  const events: GameEvent[] = [];

  if (prev.auction && !next.auction && prev.deckCount !== next.deckCount) {
    const { card, highestBid, sellerId } = prev.auction;
    const speciesLabel = SPECIES_LABEL[card.species];
    if (highestBid) {
      const buyerName = playerName(next, highestBid.playerId);
      events.push({
        kind: "auctionResolved",
        text: `${buyerName} a remporté ${speciesLabel} pour ${highestBid.amount}`,
      });
    } else {
      const sellerName = playerName(next, sellerId);
      events.push({
        kind: "auctionResolved",
        text: `${sellerName} n'a rien payé pour ${speciesLabel}`,
      });
    }
  }

  if (prev.kuhhandel && !next.kuhhandel) {
    const { initiatorId, targetId, species } = prev.kuhhandel;
    events.push({
      kind: "kuhhandelResolved",
      text: `${playerName(next, initiatorId)} et ${playerName(next, targetId)} ont échangé ${SPECIES_LABEL[species]}`,
    });
  }

  if (next.donkeyRevealCount > prev.donkeyRevealCount) {
    for (let i = prev.donkeyRevealCount; i < next.donkeyRevealCount; i++) {
      const amount = DONKEY_BONUS_SEQUENCE[i] ?? DONKEY_BONUS_SEQUENCE[DONKEY_BONUS_SEQUENCE.length - 1]!;
      events.push({
        kind: "donkeyPayout",
        text: `Âne doré : chaque joueur reçoit ${amount}`,
      });
    }
  }

  for (const { playerId, species } of detectFamilyCompletions(prev, next)) {
    events.push({
      kind: "familyCompleted",
      text: `${playerName(next, playerId)} a complété la famille ${SPECIES_LABEL[species]} !`,
    });
  }

  return events;
}
```

- [ ] **Step 2: Remove the now-duplicated local `familyCounts` from `GameTable.tsx`**

`apps/web/components/GameTable.tsx` — delete the local function (lines 32-36):

```ts
function familyCounts(animals: { species: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of animals) counts[a.species] = (counts[a.species] ?? 0) + 1;
  return counts;
}
```

and import it instead, alongside the other `lib` imports:

```ts
import { familyCounts } from "../lib/gameEvents";
```

(`familyCounts` is already called at line 262 in the opponents-row rendering — this import keeps that call site working unchanged.)

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @kuhhandel/web typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/gameEvents.ts apps/web/components/GameTable.tsx
git commit -m "feat(web): derive game-feed events and family completions from state diffs"
```

---

### Task 4: `EventFeed` presentational component

**Files:**
- Create: `packages/ui/src/EventFeed/EventFeed.tsx`
- Create: `packages/ui/src/EventFeed/EventFeed.module.css`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: nothing external.
- Produces: `EventFeedEntry { id: string; text: string }`, `EventFeedProps { entries: EventFeedEntry[] }`, `EventFeed` component — consumed by Task 5.

- [ ] **Step 1: Write `EventFeed.tsx`**

```tsx
import styles from './EventFeed.module.css';

export interface EventFeedEntry {
  id: string;
  text: string;
}

export interface EventFeedProps {
  /** Newest first — the caller owns ordering and the 50-entry cap (spec §1). */
  entries: EventFeedEntry[];
}

export function EventFeed({ entries }: EventFeedProps) {
  return (
    <div className={styles.feed}>
      <div className={styles.header}>Journal de partie</div>
      {entries.length === 0 ? (
        <div className={styles.empty}>Aucun événement pour l'instant.</div>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.item}>
              {entry.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `EventFeed.module.css`**

```css
.feed {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--kd-surface);
  border: 1px solid var(--kd-border);
  border-radius: var(--kd-radius-md);
  overflow: hidden;
}

.header {
  flex-shrink: 0;
  padding: var(--kd-space-3) var(--kd-space-4);
  font-family: var(--kd-font-display);
  font-size: 13px;
  color: var(--kd-text-muted);
  border-bottom: 1px solid var(--kd-border);
}

.empty {
  padding: var(--kd-space-4);
  font-size: 12px;
  color: var(--kd-text-subtle);
}

.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: var(--kd-space-2) var(--kd-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--kd-space-2);
}

.item {
  font-size: 13px;
  line-height: 1.4;
  color: var(--kd-text);
  padding-bottom: var(--kd-space-2);
  border-bottom: 1px solid var(--kd-surface-alt);
}

.item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
```

- [ ] **Step 3: Export from the barrel**

`packages/ui/src/index.ts` — append:

```ts
export { EventFeed } from './EventFeed/EventFeed';
export type { EventFeedEntry, EventFeedProps } from './EventFeed/EventFeed';
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @kuhhandel/ui typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/EventFeed packages/ui/src/index.ts
git commit -m "feat(ui): add EventFeed component"
```

---

### Task 5: Wire the event feed into `GameTable`

**Files:**
- Create: `apps/web/hooks/useEventFeed.ts`
- Modify: `apps/web/components/GameTable.tsx`
- Modify: `apps/web/components/GameTable.module.css`

**Interfaces:**
- Consumes: `deriveGameEvents` (Task 3), `EventFeed`/`EventFeedEntry` (Task 4).
- Produces: `useEventFeed(state: GameStateView | null): EventFeedEntry[]` (newest first, capped at 50) — used only by `GameTable.tsx`.

- [ ] **Step 1: Write `useEventFeed.ts`**

```ts
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
```

- [ ] **Step 2: Call the hook and render `EventFeed` in `GameTable.tsx`**

Add the import (alongside the other `@kuhhandel/ui` import, line 9):

```ts
import { Button, EventFeed, InfoStatusIcon, PlayerAvatarBadge, PlayingCard, ToastNarrator } from "@kuhhandel/ui";
import { useEventFeed } from "../hooks/useEventFeed";
```

Call the hook **before** the existing early-return (`if (!state || !playerId) return null;`, currently line 162) — hooks must run unconditionally on every render:

```ts
export function GameTable() {
  const state = useGameStore((s) => s.state);
  const playerId = useGameStore((s) => s.playerId);
  const leave = useGameStore((s) => s.leave);
  const eventFeedEntries = useEventFeed(state);
  if (!state || !playerId) return null;
```

Render it as a new sidebar inside `.table`, alongside `.centerStage` (the existing structure at lines 271-297 only contains `.centerStage`; wrap both in a new flex row):

```tsx
      <div className={styles.tableRow}>
        <div className={styles.centerStage}>
          {state.auction && (
            <div className={styles.auctionStage}>
              <div className={styles.auctionCard}>
                <PlayingCard
                  variant="animal"
                  label={SPECIES_LABEL[state.auction.card.species]}
                  value={SPECIES_FAMILY_VALUE[state.auction.card.species]}
                  imageSlot={SPECIES_IMAGE_SLOT[state.auction.card.species]}
                  accentColor={SPECIES_COLOR[state.auction.card.species]}
                />
              </div>
              <AuctionPanel />
            </div>
          )}
          <KuhhandelPanel />
          {latestNarratorMessage && (
            <div className={styles.narratorSlot}>
              <ToastNarrator narratorStyle="sport" message={latestNarratorMessage.text} />
            </div>
          )}
        </div>
        <div className={styles.eventFeedSlot}>
          <EventFeed entries={eventFeedEntries} />
        </div>
      </div>
```

(This replaces the bare `<div className={styles.centerStage}>...</div>` block that currently sits directly inside `.table` — `.centerStage`'s own contents are unchanged, only its wrapping div changes.)

- [ ] **Step 3: Add the layout CSS**

`apps/web/components/GameTable.module.css` — add near `.centerStage`'s existing rules:

```css
.tableRow {
  display: flex;
  gap: var(--kd-space-5);
  align-items: flex-start;
  flex: 1;
  min-height: 0;
}

.eventFeedSlot {
  width: 260px;
  flex-shrink: 0;
  height: 320px;
}
```

And inside the existing `@media (max-width: 768px)` block (starting line 488) — collapse the feed into a shorter drawer under the table, matching the existing mobile-stacking pattern used for `.opponentsRow`/`.selfRail`:

```css
  .tableRow {
    flex-direction: column;
  }

  .eventFeedSlot {
    width: 100%;
    height: 160px;
  }
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @kuhhandel/web typecheck`
Expected: PASS

- [ ] **Step 5: Manual check**

Use the `run` skill to launch the app, start a game, run an auction to resolution, and confirm an "X a remporté ..." entry appears at the top of the event feed sidebar (desktop width) and that resizing the viewport below 768px collapses it into the drawer layout without breaking other panels.

- [ ] **Step 6: Commit**

```bash
git add apps/web/hooks/useEventFeed.ts apps/web/components/GameTable.tsx apps/web/components/GameTable.module.css
git commit -m "feat(web): wire persistent event feed into GameTable"
```

---

### Task 6: Card-flip reveal animation

**Files:**
- Modify: `packages/ui/src/PlayingCard/PlayingCard.tsx`
- Modify: `packages/ui/src/PlayingCard/PlayingCard.module.css`
- Modify: `apps/web/components/GameTable.tsx`

**Interfaces:**
- Produces: `PlayingCardProps.revealing?: boolean` — a one-shot flag, not persistent state. `GameTable.tsx` computes it per render from a ref-tracked "last seen auction card id."

- [ ] **Step 1: Add the `revealing` prop and flip markup**

`packages/ui/src/PlayingCard/PlayingCard.tsx` — extend the props and wrap `.card` in a flip container only when revealing:

```tsx
'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import styles from './PlayingCard.module.css';

export type PlayingCardVariant = 'animal' | 'money';

export interface PlayingCardProps {
  variant: PlayingCardVariant;
  label: string;
  value: number;
  imageSlot: string;
  accentColor: string;
  /** One-shot: true only for the render cycle where this card first appears
   * face-up (spec §2 "Card flip") — not a persistent state the caller keeps
   * toggled on. */
  revealing?: boolean;
}

export function PlayingCard({
  variant,
  label,
  value,
  imageSlot,
  accentColor,
  revealing = false,
}: PlayingCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const style = { '--pc-accent': accentColor } as CSSProperties;

  const cardClassName = [styles.card, styles[variant], revealing ? styles.revealing : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.wrapper}>
      <div className={revealing ? styles.flipContainer : undefined}>
        <div className={cardClassName} style={style}>
          <div className={styles.art}>
            {imageFailed ? (
              <div className={styles.placeholder}>{label}</div>
            ) : (
              <img
                src={`/cards/${imageSlot}.webp`}
                alt={label}
                className={styles.image}
                onError={() => setImageFailed(true)}
              />
            )}
          </div>
          <div className={styles.value}>{value}</div>
        </div>
      </div>
      <div className={styles.caption}>{label}</div>
    </div>
  );
}
```

- [ ] **Step 2: Add the flip keyframes**

`packages/ui/src/PlayingCard/PlayingCard.module.css` — append:

```css
.flipContainer {
  perspective: 800px;
}

@keyframes kd-card-flip {
  from {
    transform: rotateY(180deg);
  }
  to {
    transform: rotateY(0deg);
  }
}

.revealing {
  transform-style: preserve-3d;
  backface-visibility: hidden;
  animation: kd-card-flip 0.5s ease-out;
}
```

- [ ] **Step 3: Wire the one-shot flag in `GameTable.tsx`**

Add a ref tracking the last-seen auction card id, updated in an effect (so the flag only reads `true` for the render where the id just changed, per the spec's "one-shot flag, not a persistent state"):

```ts
  const lastRevealedCardIdRef = useRef<string | null>(null);
  const auctionCardId = state?.auction?.card.id ?? null;
  const isFreshReveal = auctionCardId !== null && auctionCardId !== lastRevealedCardIdRef.current;

  useEffect(() => {
    lastRevealedCardIdRef.current = auctionCardId;
  }, [auctionCardId]);
```

Place this block alongside the other hooks added in Task 5, before the early return. Then pass it to the auction stage card:

```tsx
                <PlayingCard
                  variant="animal"
                  label={SPECIES_LABEL[state.auction.card.species]}
                  value={SPECIES_FAMILY_VALUE[state.auction.card.species]}
                  imageSlot={SPECIES_IMAGE_SLOT[state.auction.card.species]}
                  accentColor={SPECIES_COLOR[state.auction.card.species]}
                  revealing={isFreshReveal}
                />
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @kuhhandel/ui typecheck && pnpm --filter @kuhhandel/web typecheck`
Expected: PASS

- [ ] **Step 5: Manual check**

Use the `run` skill: start an auction and confirm the revealed card visibly flips once; confirm it does **not** re-flip on subsequent renders of the same auction (e.g. after placing a bid); confirm with OS-level "reduce motion" enabled the flip is instant (no animated rotation), per the existing sitewide override.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/PlayingCard apps/web/components/GameTable.tsx
git commit -m "feat(ui): add one-shot card-flip reveal animation"
```

---

### Task 7: Family-complete glow

**Files:**
- Modify: `packages/ui/src/PlayingCard/PlayingCard.tsx`
- Modify: `packages/ui/src/PlayingCard/PlayingCard.module.css`
- Create: `apps/web/hooks/useFamilyGlow.ts`
- Modify: `apps/web/components/GameTable.tsx`

**Interfaces:**
- Consumes: `detectFamilyCompletions` (Task 3).
- Produces: `PlayingCardProps.completed?: boolean` (persistent, non-animated highlighted rest state), `PlayingCardProps.justCompleted?: boolean` (one-shot pulse, plays once); `useFamilyGlow(state, playerId): { isCompleted(species): boolean; isJustCompleted(species): boolean }` for one player's own hand.

- [ ] **Step 1: Add `completed`/`justCompleted` props to `PlayingCard`**

`packages/ui/src/PlayingCard/PlayingCard.tsx` — extend props and className list:

```tsx
export interface PlayingCardProps {
  variant: PlayingCardVariant;
  label: string;
  value: number;
  imageSlot: string;
  accentColor: string;
  revealing?: boolean;
  /** Persistent, non-animated highlighted rest state once this card's
   * 4-of-a-kind family is complete (spec §2 "Family-complete glow"). */
  completed?: boolean;
  /** One-shot pulse played the instant the family completes; settles into
   * the `completed` rest state afterwards. */
  justCompleted?: boolean;
}

export function PlayingCard({
  variant,
  label,
  value,
  imageSlot,
  accentColor,
  revealing = false,
  completed = false,
  justCompleted = false,
}: PlayingCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const style = { '--pc-accent': accentColor } as CSSProperties;

  const cardClassName = [
    styles.card,
    styles[variant],
    revealing ? styles.revealing : '',
    completed ? styles.completed : '',
    justCompleted ? styles.justCompleted : '',
  ]
    .filter(Boolean)
    .join(' ');

  // ...rest unchanged, using cardClassName as before
```

- [ ] **Step 2: Add the glow CSS**

`packages/ui/src/PlayingCard/PlayingCard.module.css` — append:

```css
@keyframes kd-family-pulse {
  0%,
  100% {
    box-shadow: 0 0 var(--kd-glow-radius-md)
      color-mix(in oklch, var(--pc-accent) var(--kd-glow-strength), transparent);
  }
  50% {
    box-shadow: 0 0 var(--kd-glow-radius-lg)
      color-mix(in oklch, var(--pc-accent) 90%, transparent);
  }
}

.justCompleted {
  animation: kd-family-pulse 0.6s ease-in-out 2;
}

.completed {
  box-shadow: 0 0 var(--kd-glow-radius-md)
    color-mix(in oklch, var(--pc-accent) var(--kd-glow-strength-strong), transparent);
}
```

- [ ] **Step 3: Write `useFamilyGlow.ts`**

```ts
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
```

- [ ] **Step 4: Wire it into the self-hand render**

`apps/web/components/GameTable.tsx` — add the hook call (with the other hooks, before the early return):

```ts
  const familyGlow = useFamilyGlow(state, playerId);
```

Pass the new props on the self-hand `PlayingCard` (the same block edited in Task 2 Step 3):

```tsx
            {currentPlayer.animals.map((a) => (
              <div key={a.id} className={styles.selfHandCard}>
                <PlayingCard
                  variant="animal"
                  label={SPECIES_LABEL[a.species]}
                  value={SPECIES_FAMILY_VALUE[a.species]}
                  imageSlot={SPECIES_IMAGE_SLOT[a.species]}
                  accentColor={SPECIES_COLOR[a.species]}
                  completed={familyGlow.isCompleted(a.species)}
                  justCompleted={familyGlow.isJustCompleted(a.species)}
                />
              </div>
            ))}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @kuhhandel/ui typecheck && pnpm --filter @kuhhandel/web typecheck`
Expected: PASS

- [ ] **Step 6: Manual check**

Use the `run` skill: play until one species reaches 4-of-a-kind in your own hand; confirm the pulse plays twice then settles into a persistent subtle glow that stays after further unrelated state updates (e.g. after the next auction resolves).

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/PlayingCard apps/web/hooks/useFamilyGlow.ts apps/web/components/GameTable.tsx
git commit -m "feat(ui): add family-complete glow animation"
```

---

### Task 8: FLIP transfer utility and `TransferGhost`

**Files:**
- Create: `packages/ui/src/utils/flip.ts`
- Create: `packages/ui/src/TransferGhost/TransferGhost.tsx`
- Create: `packages/ui/src/TransferGhost/TransferGhost.module.css`
- Modify: `packages/ui/src/index.ts`
- Modify: `packages/ui/package.json`

**Interfaces:**
- Produces: `Rect { top: number; left: number; width: number; height: number }`, `rectOf(el: HTMLElement): Rect`, `deltaTransform(from: Rect, to: Rect): string`, `TransferGhostProps { from: Rect; to: Rect; durationMs?: number; onDone: () => void; children: ReactNode }`, `TransferGhost` component — consumed by Task 9.

- [ ] **Step 1: Write `flip.ts`**

```ts
export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** FLIP-technique transform: given the element's First rect and Last rect,
 * returns the CSS transform that visually keeps it at First — the caller
 * then clears this transform to let it animate into Last (spec §2). */
export function deltaTransform(from: Rect, to: Rect): string {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const sx = to.width === 0 ? 1 : from.width / to.width;
  const sy = to.height === 0 ? 1 : from.height / to.height;
  return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
}
```

- [ ] **Step 2: Add `react-dom` as a dependency for the portal**

`packages/ui/package.json` — add to `dependencies` (peer `react-dom` is needed for `createPortal`; mirrors the existing `react` peerDependency pattern):

```json
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
```

and add `react-dom`/`@types/react-dom` to `devDependencies` (matching the existing `react`/`@types/react` dev entries):

```json
  "devDependencies": {
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.7.2"
  }
```

Run `pnpm install` after editing so the workspace lockfile picks up the new dependency.

- [ ] **Step 3: Write `TransferGhost.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { deltaTransform, type Rect } from '../utils/flip';
import styles from './TransferGhost.module.css';

export interface TransferGhostProps {
  /** Where the moved content visually starts. */
  from: Rect;
  /** Where the moved content ends up — matches its real destination DOM
   * position, so this ghost hands off invisibly to the real render. */
  to: Rect;
  durationMs?: number;
  onDone: () => void;
  children: ReactNode;
}

/** Portal-rendered ghost element that plays a single FLIP transition from
 * `from` to `to`, then calls `onDone` — used for both money and animal card
 * transfers (spec §2: "one utility, reused by both"), never mutates any
 * game state itself. */
export function TransferGhost({ from, to, durationMs = 500, onDone, children }: TransferGhostProps) {
  const [animateIn, setAnimateIn] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimateIn(true));
    const timer = setTimeout(() => onDoneRef.current(), durationMs);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [durationMs]);

  const style = {
    position: 'fixed' as const,
    top: to.top,
    left: to.left,
    width: to.width,
    height: to.height,
    transform: animateIn ? 'none' : deltaTransform(from, to),
    transition: animateIn ? `transform ${durationMs}ms ease` : 'none',
  };

  return createPortal(
    <div style={style} className={styles.ghost}>
      {children}
    </div>,
    document.body,
  );
}
```

- [ ] **Step 4: Add `TransferGhost.module.css`**

```css
.ghost {
  pointer-events: none;
  z-index: 1000;
}
```

- [ ] **Step 5: Export from the barrel**

`packages/ui/src/index.ts` — append:

```ts
export { TransferGhost } from './TransferGhost/TransferGhost';
export type { TransferGhostProps } from './TransferGhost/TransferGhost';

export { rectOf, deltaTransform } from './utils/flip';
export type { Rect } from './utils/flip';
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @kuhhandel/ui typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/utils packages/ui/src/TransferGhost packages/ui/src/index.ts packages/ui/package.json pnpm-lock.yaml
git commit -m "feat(ui): add FLIP-based TransferGhost utility"
```

---

### Task 9: Wire money and animal transfer animations

**Files:**
- Create: `apps/web/lib/cardPositions.ts`
- Modify: `apps/web/components/GameTable.tsx`
- Modify: `apps/web/components/AuctionPanel.tsx`
- Modify: `apps/web/components/KuhhandelPanel.tsx`

**Interfaces:**
- Consumes: `TransferGhost`, `rectOf`, `Rect` (Task 8); `SPECIES_COLOR` (Task 2).
- Produces: `registerCardPosition(id: string, el: HTMLElement | null): void`, `getCardRect(id: string): Rect | null`, `registerPlayerSlot(playerId: string, el: HTMLElement | null): void`, `getPlayerSlotRect(playerId: string): Rect | null` — a module-level DOM-position registry any component can read from/write to without prop-drilling refs through the panel tree.

- [ ] **Step 1: Write the position registry**

```ts
import { rectOf, type Rect } from "@kuhhandel/ui";

const cardEls = new Map<string, HTMLElement>();
const playerSlotEls = new Map<string, HTMLElement>();

/** Registers (or clears, on unmount) the DOM node currently rendering a
 * given card id, so a transfer animation elsewhere can look up its exact
 * on-screen position without prop-drilling refs through every panel. */
export function registerCardPosition(id: string, el: HTMLElement | null): void {
  if (el) cardEls.set(id, el);
  else cardEls.delete(id);
}

export function getCardRect(id: string): Rect | null {
  const el = cardEls.get(id);
  return el ? rectOf(el) : null;
}

/** Registers a per-player "slot" DOM node (self-rail or opponent card) used
 * as a transfer destination/source when the exact moved card isn't (yet)
 * individually rendered for that player — e.g. an opponent's hidden money. */
export function registerPlayerSlot(playerId: string, el: HTMLElement | null): void {
  if (el) playerSlotEls.set(playerId, el);
  else playerSlotEls.delete(playerId);
}

export function getPlayerSlotRect(playerId: string): Rect | null {
  const el = playerSlotEls.get(playerId);
  return el ? rectOf(el) : null;
}
```

- [ ] **Step 2: Register the existing DOM anchors**

`apps/web/components/GameTable.tsx` — add a ref callback to the opponent card wrapper (the `.opponentCard` div, inside the `.map` at lines 243-267) and the self-identity block (lines 310-320), plus each self-hand animal card wrapper (lines 325-336):

```tsx
                <div
                  key={p.id}
                  className={styles.opponentCard}
                  ref={(el) => registerPlayerSlot(p.id, el)}
                >
```

```tsx
          <div className={styles.selfIdentity} ref={(el) => registerPlayerSlot(playerId, el)}>
```

```tsx
              <div
                key={a.id}
                className={styles.selfHandCard}
                ref={(el) => registerCardPosition(a.id, el)}
              >
```

Import the registry functions:

```ts
import { registerCardPosition, registerPlayerSlot } from "../lib/cardPositions";
```

- [ ] **Step 3: Register the auction/Kuhhandel money-card DOM anchors**

`apps/web/components/AuctionPanel.tsx` — add a ref to each bid button (the `.bidCard` button wrapping the money `PlayingCard`, lines 44-62):

```tsx
                <button
                  key={card.id}
                  type="button"
                  ref={(el) => registerCardPosition(card.id, el)}
                  className={...}
```

with the import `import { registerCardPosition } from "../lib/cardPositions";` added.

`apps/web/components/KuhhandelPanel.tsx` — same pattern on the `MoneyPicker`'s `.moneyToggle` button (lines 37-54) and the initiator's revealed-offer `.trayCard` div (lines 158-167), each with `ref={(el) => registerCardPosition(card.id, el)}` and the same import added once at the top of the file.

- [ ] **Step 4: Derive transfer intents and render ghosts in `GameTable.tsx`**

Add a hook that detects, on each state diff, what moved and where from/to — reusing the already-public `players[].animals` diff (safe: animal ownership is public) and `moneyCount` diff (count-only, so no opponent-hidden values ever leak per this plan's Global Constraints):

```ts
interface AnimalTransfer {
  cardId: string;
  species: string;
  fromPlayerId: string;
  toPlayerId: string;
}

interface MoneyTransfer {
  fromPlayerId: string;
  toPlayerId: string;
  cardCount: number;
}

function detectAnimalTransfers(prev: GameStateView | null, next: GameStateView): AnimalTransfer[] {
  if (!prev) return [];
  const transfers: AnimalTransfer[] = [];
  const prevOwner = new Map<string, string>();
  for (const p of prev.players) for (const a of p.animals) prevOwner.set(a.id, p.id);

  for (const p of next.players) {
    for (const a of p.animals) {
      const before = prevOwner.get(a.id);
      if (before && before !== p.id) {
        transfers.push({ cardId: a.id, species: a.species, fromPlayerId: before, toPlayerId: p.id });
      }
    }
  }
  return transfers;
}

function detectMoneyTransfers(prev: GameStateView | null, next: GameStateView): MoneyTransfer[] {
  if (!prev) return [];
  const transfers: MoneyTransfer[] = [];
  const deltas = next.players.map((p) => {
    const before = prev.players.find((pp) => pp.id === p.id)?.moneyCount ?? p.moneyCount;
    return { playerId: p.id, delta: p.moneyCount - before };
  });
  const payers = deltas.filter((d) => d.delta < 0);
  const payees = deltas.filter((d) => d.delta > 0);
  // Single-payer/single-payee is the only shape auctions and Kuhhandel produce.
  if (payers.length === 1 && payees.length === 1) {
    transfers.push({
      fromPlayerId: payers[0]!.playerId,
      toPlayerId: payees[0]!.playerId,
      cardCount: payees[0]!.delta,
    });
  }
  return transfers;
}
```

Place these two functions in `apps/web/lib/gameEvents.ts` instead (Task 3's file) so they sit next to the other diffing logic rather than inline in the component — export them and import into `GameTable.tsx`.

In `GameTable.tsx`, add state to track active ghosts and a diffing effect (with the other hooks, before the early return):

```ts
  const prevTransferStateRef = useRef<GameStateView | null>(null);
  const [animalGhosts, setAnimalGhosts] = useState<
    (AnimalTransfer & { id: string; from: Rect; to: Rect })[]
  >([]);
  const [moneyGhosts, setMoneyGhosts] = useState<
    (MoneyTransfer & { id: string; from: Rect; to: Rect })[]
  >([]);
  const ghostSeqRef = useRef(0);

  useEffect(() => {
    if (!state) return;
    const prevState = prevTransferStateRef.current;
    const animalTransfers = detectAnimalTransfers(prevState, state);
    const moneyTransfers = detectMoneyTransfers(prevState, state);
    prevTransferStateRef.current = state;

    for (const t of animalTransfers) {
      const from = getPlayerSlotRect(t.fromPlayerId) ?? getCardRect(t.cardId);
      const to = getPlayerSlotRect(t.toPlayerId);
      if (!from || !to) continue;
      const id = `${ghostSeqRef.current++}`;
      setAnimalGhosts((prev) => [...prev, { ...t, id, from, to }]);
    }
    for (const t of moneyTransfers) {
      const from = getPlayerSlotRect(t.fromPlayerId);
      const to = getPlayerSlotRect(t.toPlayerId);
      if (!from || !to) continue;
      const id = `${ghostSeqRef.current++}`;
      setMoneyGhosts((prev) => [...prev, { ...t, id, from, to }]);
    }
  }, [state]);
```

Render the ghosts at the bottom of the component (alongside `<RareEventBanner state={state} />`):

```tsx
      {animalGhosts.map((g) => (
        <TransferGhost
          key={g.id}
          from={g.from}
          to={g.to}
          onDone={() => setAnimalGhosts((prev) => prev.filter((x) => x.id !== g.id))}
        >
          <PlayingCard
            variant="animal"
            label={SPECIES_LABEL[g.species as keyof typeof SPECIES_LABEL]}
            value={SPECIES_FAMILY_VALUE[g.species as keyof typeof SPECIES_FAMILY_VALUE]}
            imageSlot={SPECIES_IMAGE_SLOT[g.species as keyof typeof SPECIES_IMAGE_SLOT]}
            accentColor={SPECIES_COLOR[g.species as keyof typeof SPECIES_COLOR]}
          />
        </TransferGhost>
      ))}
      {moneyGhosts.map((g) => (
        <TransferGhost
          key={g.id}
          from={g.from}
          to={g.to}
          onDone={() => setMoneyGhosts((prev) => prev.filter((x) => x.id !== g.id))}
        >
          {/* Generic bill-back visual: the viewer isn't necessarily a party
              to this transfer and must never be shown a value they have no
              way of actually knowing (existing hidden-info invariant). */}
          <PlayingCard
            variant="money"
            label={`${g.cardCount} carte(s)`}
            value={0}
            imageSlot="bill-0"
            accentColor="var(--kd-accent-yellow)"
          />
        </TransferGhost>
      ))}
```

`apps/web/public/cards/bill-0.webp` already exists (the box's blank/zero-value bill) — reused here as the generic "unknown value" art for a transfer the viewer isn't necessarily a party to, so no new asset is needed.

Import `TransferGhost` alongside the other `@kuhhandel/ui` imports, and `detectAnimalTransfers`, `detectMoneyTransfers`, `getCardRect`, `getPlayerSlotRect`, `AnimalTransfer`, `MoneyTransfer`, `Rect` from their respective modules.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/ui typecheck`
Expected: PASS

- [ ] **Step 6: Manual check**

Use the `run` skill with two browser sessions (two players) per the existing local dev pattern: run an auction to a sale and confirm both an animal-card ghost animates from seller to buyer and a money-card ghost animates from buyer to seller, each settling into place without a flash-jump; repeat for a Kuhhandel accept.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/cardPositions.ts apps/web/lib/gameEvents.ts apps/web/components/GameTable.tsx apps/web/components/AuctionPanel.tsx apps/web/components/KuhhandelPanel.tsx
git commit -m "feat(web): animate money and animal card transfers"
```

---

### Task 10: Full manual verification pass

**Files:** none (verification only, per the spec's Testing section).

- [ ] **Step 1: Run every automated gate one more time end-to-end**

```bash
pnpm --filter @kuhhandel/realtime-server test
pnpm --filter @kuhhandel/shared-types typecheck
pnpm --filter @kuhhandel/realtime-server typecheck
pnpm --filter @kuhhandel/ui typecheck
pnpm --filter @kuhhandel/web typecheck
pnpm --filter @kuhhandel/web lint
```

Expected: all PASS.

- [ ] **Step 2: Manual playthrough via the `run` skill**

Play a full game (2+ browser sessions) through to completion and confirm, checking off each as verified:
- Event feed shows an entry for: auction resolved (both the "won for X" and "kept, nobody paid" phrasing), Kuhhandel resolved, golden-donkey payout (correct 50/100/200/500 amount per reveal), family completed.
- Feed scrolls and retains history across many events without duplicating or dropping entries; caps at 50 without erroring.
- Auction card flips once on reveal, not on subsequent bids on the same card.
- A family reaching 4-of-a-kind pulses twice then settles into a persistent glow that survives later, unrelated state updates.
- Money and animal transfer ghosts animate on both auction sales and Kuhhandel resolutions, for both the local player's own transfers and an opponent-to-opponent transfer (3+ players).
- Every species' animal cards share one fixed color everywhere they render (self-hand, auction stage, transfer ghosts) — cross-check against the table in the spec's §3.
- Toggle OS-level "reduce motion" and confirm all animations collapse to instant per the existing sitewide override — nothing breaks or becomes invisible.
- Resize below 768px and confirm the event feed collapses into its mobile drawer layout alongside the existing responsive panels.

- [ ] **Step 3: Fix anything found, then this task is done — no commit of its own unless fixes were needed.**
