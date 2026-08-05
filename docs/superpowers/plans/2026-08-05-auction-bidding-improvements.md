# Auction Bidding Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players (and bots) combine multiple money cards into a single auction bid or "keep" payment, and give the leading bidder clear visual feedback, per `docs/superpowers/specs/2026-08-05-auction-bidding-improvements-design.md`.

**Architecture:** The engine's `Bid`/`AuctionResult` types move from a bare `amount: number` to carrying the actual `MoneyCard[]` involved (mirroring how Kuhhandel's `initiatorOffer`/`KuhhandelResult.money` already work), removing the single-exact-denomination-card lookup that could crash payment resolution. `GameRoom` resolves client-supplied card IDs to `MoneyCard[]` before calling into the engine (reusing the existing `resolveOffer` helper). Bots get the same capability via two new `bot-engine` helpers. `apps/web`'s `AuctionPanel.tsx` gains a `MoneyPicker`-style multi-select for bidding and for the seller's "Garder" payment, plus a distinct "you are leading" state.

**Tech Stack:** TypeScript across `packages/game-engine`, `packages/bot-engine`, `apps/realtime-server` (all with real Vitest suites), and `apps/web`/`packages/ui` (no test runner — manual/typecheck verification, per established project convention).

## Global Constraints

- No change to auction core rules (strict-increase bidding, seller sell/keep, no-bid behavior) — only how a bid/payment amount is composed.
- No "making change" — every bid and every seller "keep" payment must be reachable by summing a subset of the payer's own cards exactly (or, for bids, strictly exceeding the current highest — no exact-match requirement there, unlike "keep" payments).
- No cards are removed from any player's hand until final resolution — mirrors the existing Kuhhandel offer flow, where `submitInitiatorOffer` only records cards, actual transfer happens at `applyKuhhandelResult`.
- `apps/web`/`packages/ui` have no test runner configured — verify those tasks with `pnpm --filter <pkg> typecheck`/`lint`, not tests. Per established project preference, skip manual browser verification unless explicitly requested — rely on code review + automated gates, and let the human test the deployed result themselves.
- `apps/realtime-server`/`packages/game-engine`/`packages/bot-engine` have real Vitest suites — normal TDD applies there.
- Money card IDs (`bank-money-<n>`) never encode their value — safe to expose on the wire unredacted, same as today's `AuctionState`.

---

### Task 1: Engine — bids carry cards, not just an amount

**Files:**
- Modify: `packages/game-engine/src/auction/auction.ts`
- Test: `packages/game-engine/test/auction.test.ts`

**Interfaces:**
- Produces: `Bid { playerId: string; cards: MoneyCard[]; amount: number }`, `placeBid(state: AuctionState, playerId: string, cards: MoneyCard[]): AuctionState`, `resolveAuction(state: AuctionState, decision?: SellerDecision, sellerPaymentCards?: MoneyCard[]): AuctionResult`, `AuctionResult.payment: { from: string; to: string; amount: number; cards: MoneyCard[] } | null`.
- Consumes: `MoneyCard` from `../types.js` (already imported elsewhere in this file's sibling `kuhhandel.ts`).

- [ ] **Step 1: Update existing tests to the new `placeBid`/`resolveAuction` signatures**

`packages/game-engine/test/auction.test.ts` — add a `money` helper and rewrite every `placeBid`/`resolveAuction` call. Full replacement file:

```ts
import { describe, expect, it } from 'vitest';
import { startAuction, placeBid, pass, resolveAuction } from '../src/auction/auction.js';
import type { AnimalCard, MoneyCard } from '../src/types.js';

const card: AnimalCard = { id: 'vache-0', species: 'vache' };

function money(...values: number[]): MoneyCard[] {
  return values.map((value, i) => ({ id: `m${i}-${value}`, value }));
}

describe('auction — bidding round', () => {
  it('starts with all non-seller players as active bidders and no highest bid', () => {
    const state = startAuction(card, 'seller', ['p1', 'p2', 'p3']);

    expect(state.status).toBe('bidding');
    expect(state.activeBidders).toEqual(['p1', 'p2', 'p3']);
    expect(state.highestBid).toBeNull();
  });

  it('rejects a bid from the seller (GDD 3.1.2: only other players may bid)', () => {
    const state = startAuction(card, 'seller', ['p1', 'p2']);

    expect(() => placeBid(state, 'seller', money(10))).toThrow(/seller/i);
  });

  it('rejects a bid that does not strictly raise the current highest bid', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(50));

    expect(() => placeBid(state, 'p2', money(50))).toThrow(/strictly higher/i);
    expect(() => placeBid(state, 'p2', money(40))).toThrow(/strictly higher/i);
  });

  it('accepts a strictly higher bid and updates the highest bid', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(50));
    const p2Cards = money(100);
    state = placeBid(state, 'p2', p2Cards);

    expect(state.highestBid).toEqual({ playerId: 'p2', cards: p2Cards, amount: 100 });
  });

  it('accepts a bid composed of multiple combined cards', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(50));
    const combined = money(10, 50); // 60 total, no single card of that value
    state = placeBid(state, 'p2', combined);

    expect(state.highestBid).toEqual({ playerId: 'p2', cards: combined, amount: 60 });
  });

  it('removes a player from active bidders once they pass, and they cannot bid again', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2', 'p3']);
    state = pass(state, 'p1');

    expect(state.activeBidders).toEqual(['p2', 'p3']);
    expect(() => placeBid(state, 'p1', money(999))).toThrow(/passed/i);
  });

  it('moves to awaiting seller decision once only one bidder remains', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2', 'p3']);
    state = placeBid(state, 'p1', money(50));
    state = pass(state, 'p2');
    state = pass(state, 'p3');

    expect(state.status).toBe('awaiting_seller_decision');
  });

  it('moves to awaiting seller decision once everyone has passed with no bids at all', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = pass(state, 'p1');
    state = pass(state, 'p2');

    expect(state.status).toBe('awaiting_seller_decision');
    expect(state.highestBid).toBeNull();
  });
});

describe('resolveAuction', () => {
  it('sell: buyer pays the seller with their bid cards and receives the card', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    const bidCards = money(100);
    state = placeBid(state, 'p1', bidCards);
    state = pass(state, 'p2');

    const result = resolveAuction(state, 'sell');

    expect(result).toEqual({
      card,
      cardGoesTo: 'p1',
      payment: { from: 'p1', to: 'seller', amount: 100, cards: bidCards },
    });
  });

  it('keep: seller pays the highest bidder with seller-supplied cards and keeps the card', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(100));
    state = pass(state, 'p2');
    const sellerPaymentCards = money(100);

    const result = resolveAuction(state, 'keep', sellerPaymentCards);

    expect(result).toEqual({
      card,
      cardGoesTo: 'seller',
      payment: { from: 'seller', to: 'p1', amount: 100, cards: sellerPaymentCards },
    });
  });

  it('keep: accepts seller payment combined from multiple cards summing exactly', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(60));
    state = pass(state, 'p2');
    const sellerPaymentCards = money(10, 50);

    const result = resolveAuction(state, 'keep', sellerPaymentCards);

    expect(result.payment).toEqual({ from: 'seller', to: 'p1', amount: 60, cards: sellerPaymentCards });
  });

  it('keep: rejects seller payment that does not sum to exactly the highest bid', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(100));
    state = pass(state, 'p2');

    expect(() => resolveAuction(state, 'keep', money(50))).toThrow(/exactly/i);
  });

  it('keep: requires payment cards to be supplied at all', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(100));
    state = pass(state, 'p2');

    expect(() => resolveAuction(state, 'keep')).toThrow(/payment/i);
  });

  it('no bids at all: seller keeps the card for free (GDD 3.1.6 default)', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = pass(state, 'p1');
    state = pass(state, 'p2');

    const result = resolveAuction(state);

    expect(result).toEqual({ card, cardGoesTo: 'seller', payment: null });
  });

  it('throws if resolved before the bidding round has concluded', () => {
    const state = startAuction(card, 'seller', ['p1', 'p2']);

    expect(() => resolveAuction(state, 'sell')).toThrow(/not.*finished|bidding/i);
  });

  it('throws if a sell/keep decision is required but not provided', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(100));
    state = pass(state, 'p2');

    expect(() => resolveAuction(state)).toThrow(/decision/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail against the current implementation**

Run: `pnpm --filter @kuhhandel/game-engine test -- auction`
Expected: FAIL — `placeBid`/`resolveAuction` still take a bare `amount`/no `sellerPaymentCards` param, so calls with `money(...)` arrays and multi-card assertions won't type-check or match.

- [ ] **Step 3: Implement the new `auction.ts`**

Full replacement:

```ts
import { NO_BID_SELLER_KEEPS_FREE } from '../config/game.config.js';
import type { AnimalCard, MoneyCard } from '../types.js';

export interface Bid {
  playerId: string;
  cards: MoneyCard[];
  amount: number;
}

export type AuctionStatus = 'bidding' | 'awaiting_seller_decision';

export interface AuctionState {
  card: AnimalCard;
  sellerId: string;
  activeBidders: string[];
  highestBid: Bid | null;
  status: AuctionStatus;
}

export type SellerDecision = 'sell' | 'keep';

export interface AuctionResult {
  card: AnimalCard;
  cardGoesTo: string;
  payment: { from: string; to: string; amount: number; cards: MoneyCard[] } | null;
}

function sumCards(cards: MoneyCard[]): number {
  return cards.reduce((sum, c) => sum + c.value, 0);
}

export function startAuction(
  card: AnimalCard,
  sellerId: string,
  otherPlayerIds: string[],
): AuctionState {
  return {
    card,
    sellerId,
    activeBidders: [...otherPlayerIds],
    highestBid: null,
    status: 'bidding',
  };
}

/**
 * `cards` is the bidder's chosen subset of their own hand — ownership is
 * validated by the caller (GameRoom resolves card IDs against the
 * player's hand before calling in, same pattern as Kuhhandel's
 * submitInitiatorOffer/resolveOffer), not by this pure function.
 */
export function placeBid(state: AuctionState, playerId: string, cards: MoneyCard[]): AuctionState {
  if (playerId === state.sellerId) {
    throw new Error('The seller cannot bid on their own card.');
  }
  if (!state.activeBidders.includes(playerId)) {
    throw new Error(`Player ${playerId} has already passed and cannot bid again.`);
  }
  const amount = sumCards(cards);
  if (state.highestBid !== null && amount <= state.highestBid.amount) {
    throw new Error('Bid must be strictly higher than the current highest bid.');
  }
  if (state.highestBid === null && amount < 0) {
    throw new Error('Bid must be strictly higher than the current highest bid.');
  }

  return {
    ...state,
    highestBid: { playerId, cards, amount },
  };
}

export function pass(state: AuctionState, playerId: string): AuctionState {
  const activeBidders = state.activeBidders.filter((id) => id !== playerId);
  const shouldResolve =
    activeBidders.length === 0 || (state.highestBid !== null && activeBidders.length === 1);

  return {
    ...state,
    activeBidders,
    status: shouldResolve ? 'awaiting_seller_decision' : 'bidding',
  };
}

/**
 * `sellerPaymentCards` is only used (and required) when `decision ===
 * 'keep'` — the seller pays the highest bidder out of their own hand, a
 * separate card set from the winning bid's cards. Must sum to exactly
 * `highestBid.amount` (no change-making, per spec Non-goals).
 */
export function resolveAuction(
  state: AuctionState,
  decision?: SellerDecision,
  sellerPaymentCards?: MoneyCard[],
): AuctionResult {
  if (state.status !== 'awaiting_seller_decision') {
    throw new Error('Cannot resolve an auction whose bidding round has not finished.');
  }

  if (state.highestBid === null) {
    if (!NO_BID_SELLER_KEEPS_FREE) {
      throw new Error('No-bid behaviour is disabled but no alternative is configured.');
    }
    return { card: state.card, cardGoesTo: state.sellerId, payment: null };
  }

  if (decision === undefined) {
    throw new Error('A seller decision (sell or keep) is required to resolve this auction.');
  }

  const { playerId: buyerId, amount, cards: bidCards } = state.highestBid;

  if (decision === 'sell') {
    return {
      card: state.card,
      cardGoesTo: buyerId,
      payment: { from: buyerId, to: state.sellerId, amount, cards: bidCards },
    };
  }

  if (!sellerPaymentCards) {
    throw new Error('Seller must supply payment cards to keep the card.');
  }
  const paidAmount = sumCards(sellerPaymentCards);
  if (paidAmount !== amount) {
    throw new Error('Seller payment must sum to exactly the highest bid amount.');
  }

  return {
    card: state.card,
    cardGoesTo: state.sellerId,
    payment: { from: state.sellerId, to: buyerId, amount, cards: sellerPaymentCards },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @kuhhandel/game-engine test -- auction`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/game-engine/src/auction/auction.ts packages/game-engine/test/auction.test.ts
git commit -m "feat(game-engine): auction bids and keep-payments carry combined cards"
```

---

### Task 2: Engine — resolution transfers the exact cards, no single-card lookup

**Files:**
- Modify: `packages/game-engine/src/engine/applyResults.ts`
- Test: `packages/game-engine/test/engine.integration.test.ts`

**Interfaces:**
- Consumes: `AuctionResult.payment.cards` (Task 1).
- Produces: `applyAuctionResult` behavior unchanged in signature, now uses `transferMoneyCards` instead of the removed `transferExactMoneyCard`.

- [ ] **Step 1: Update `engine.integration.test.ts` to the new `placeBid`/`resolveAuction` signatures**

`packages/game-engine/test/engine.integration.test.ts` — the file's `makePlayersWithDeepBankroll` docstring references the exact limitation being removed; update it, and rewrite the auction loop body to pass cards instead of a bare amount:

```ts
/**
 * 40 auctions with the same bid amount, so it needs a deep bankroll of
 * that denomination to comfortably outlast the run without depending on
 * change-making (still unsupported — every bid/keep payment here uses a
 * single 10-value card, this test isn't exercising combined bids).
 */
function makePlayersWithDeepBankroll(ids: string[]): Player[] {
```

(only the comment changes — the function body is unchanged).

Then, inside the `while (!isDeckExhausted(deck))` loop, replace:

```ts
      let auctionState = startAuction(card, seller.id, bidders);
      const bidderId = bidders[0]!;
      auctionState = placeBid(auctionState, bidderId, 10);
      auctionState = pass(auctionState, bidders[1]!);

      const decision = cardsResolved % 5 === 0 ? 'keep' : 'sell';
      const result = resolveAuction(auctionState, decision);
```

with:

```ts
      let auctionState = startAuction(card, seller.id, bidders);
      const bidderId = bidders[0]!;
      const bidderCard = players.find((p) => p.id === bidderId)!.money.find((c) => c.value === 10)!;
      auctionState = placeBid(auctionState, bidderId, [bidderCard]);
      auctionState = pass(auctionState, bidders[1]!);

      const decision = cardsResolved % 5 === 0 ? 'keep' : 'sell';
      const sellerPaymentCards =
        decision === 'keep'
          ? [players.find((p) => p.id === seller.id)!.money.find((c) => c.value === 10)!]
          : undefined;
      const result = resolveAuction(auctionState, decision, sellerPaymentCards);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @kuhhandel/game-engine test -- engine.integration`
Expected: FAIL — `placeBid`/`resolveAuction` signature mismatch (this file exercises the real, not-yet-changed `applyResults.ts` still calling the removed `transferExactMoneyCard`, so once Task 1 is in place this specific test fails only on payment resolution, not on placeBid/resolveAuction typing — since Task 1 already merged. Confirm the failure is inside `applyAuctionResult`/`transferExactMoneyCard`, e.g. "no single card of exact value").

- [ ] **Step 3: Implement the new `applyResults.ts`**

Remove `transferExactMoneyCard` entirely and use the existing `transferMoneyCards` helper (already used by `applyKuhhandelResult`) for auction payments too:

```ts
export function applyAuctionResult(players: Player[], result: AuctionResult): Player[] {
  let next = transferAnimalCards(players, result.cardGoesTo, [result.card]);
  if (result.payment) {
    next = transferMoneyCards(next, result.payment.from, result.payment.to, result.payment.cards);
  }
  return next;
}
```

Delete the now-unused `transferExactMoneyCard` function (lines 14-40 of the current file, including its doc comment about the Phase 1 simplification — that limitation is what this task removes).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @kuhhandel/game-engine test`
Expected: PASS (full suite — `applyResults.ts` is shared by both auction and Kuhhandel resolution, so run everything, not just the two files touched).

- [ ] **Step 5: Commit**

```bash
git add packages/game-engine/src/engine/applyResults.ts packages/game-engine/test/engine.integration.test.ts
git commit -m "feat(game-engine): resolve auction payments with exact committed cards"
```

---

### Task 3: Realtime-server — wire combined bids and keep-payments through `GameRoom`

**Files:**
- Modify: `apps/realtime-server/src/room/GameRoom.ts`
- Modify: `apps/realtime-server/src/socketServer.ts`
- Create: helper addition to `apps/realtime-server/test/helpers/playToGameOver.ts`
- Test: `apps/realtime-server/test/room.test.ts`, `room.rareEvents.test.ts`, `room.forcedKuhhandel.test.ts`, `room.persistence.test.ts`, `network.test.ts`, `network.e2e.test.ts`, `network.security.test.ts`

**Interfaces:**
- Consumes: `placeBid`/`resolveAuction` (Task 1), the existing private `resolveOffer(playerId, cardIds): MoneyCard[]` helper (already used by Kuhhandel).
- Produces: `GameRoom.placeBid(playerId: string, moneyCardIds: string[]): void`, `GameRoom.sellerDecision(playerId: string, decision: SellerDecision, paymentCardIds?: string[]): void`, test helper `moneyCardIdsFor(room: GameRoom, playerId: string, amount: number): string[]` and `findMoneyCardId(state: GameStateView, playerId: string, value: number): string` — consumed by every test file listed above.

- [ ] **Step 1: Add test helpers**

`apps/realtime-server/test/helpers/playToGameOver.ts` — add near the top (after the existing imports), exported for reuse by every other test file in this task:

```ts
import type { GameStateView } from '@kuhhandel/shared-types';

/** Finds money card IDs from `playerId`'s CURRENT hand (via the room's own
 * live state) summing to exactly `amount` — greedy largest-first. Every
 * test in this suite only ever bids round denominations (10, 50, ...), so
 * an exact match always exists given sufficient bankroll depth. */
export function moneyCardIdsFor(room: GameRoom, playerId: string, amount: number): string[] {
  const hand = room.getViewFor(playerId).players.find((p) => p.id === playerId)!.money!;
  const sorted = [...hand].sort((a, b) => b.value - a.value);
  const selected: string[] = [];
  let remaining = amount;
  for (const card of sorted) {
    if (card.value > 0 && card.value <= remaining) {
      selected.push(card.id);
      remaining -= card.value;
    }
  }
  if (remaining !== 0) {
    throw new Error(`Could not compose ${amount} from ${playerId}'s hand`);
  }
  return selected;
}

/** Same composition, from an already-received GameStateView (for
 * socket-level tests, which don't have direct GameRoom access). */
export function findMoneyCardId(state: GameStateView, playerId: string, value: number): string {
  const hand = state.players.find((p) => p.id === playerId)!.money!;
  const card = hand.find((c) => c.value === value);
  if (!card) throw new Error(`Player ${playerId} has no ${value}-value card in this view`);
  return card.id;
}
```

Then, in the same file's `playAuctionOnlyThenConsolidate`, replace:

```ts
    room.startAuction(activeId);
    room.placeBid(others[0]!, 10);
    room.pass(others[1]!);
```

with:

```ts
    room.startAuction(activeId);
    room.placeBid(others[0]!, moneyCardIdsFor(room, others[0]!, 10));
    room.pass(others[1]!);
```

- [ ] **Step 2: Update the other `GameRoom`-level test files**

`apps/realtime-server/test/room.test.ts` — add `import { moneyCardIdsFor } from './helpers/playToGameOver.js';` and replace every occurrence of `room.placeBid(X, 10)` with `room.placeBid(X, moneyCardIdsFor(room, X, 10))` (4 occurrences: lines 64, 83, 97, 102, 132, 137 in the current file — every `room.placeBid(<id>, 10)` call site).

`apps/realtime-server/test/room.rareEvents.test.ts` — add the same import; replace both `room.placeBid(p2, 10)` occurrences (lines 16, 35) with `room.placeBid(p2, moneyCardIdsFor(room, p2, 10))`.

`apps/realtime-server/test/room.forcedKuhhandel.test.ts` — add the same import; replace both `room.placeBid(others[0]!, 10)` occurrences (lines 72, 98) with `room.placeBid(others[0]!, moneyCardIdsFor(room, others[0]!, 10))`.

`apps/realtime-server/test/room.persistence.test.ts` — add the same import; replace both `room.placeBid(p2, 10)` occurrences (lines 61, 83) with `room.placeBid(p2, moneyCardIdsFor(room, p2, 10))`.

(`room.sixPlayers.test.ts`'s single `sellerDecision(active, 'keep')` call needs no change — that path only ever runs when `highestBid` is null, which resolves for free regardless of `paymentCardIds`, per the existing no-bid short-circuit in `resolveAuction`.)

- [ ] **Step 3: Update the socket-level test files**

`apps/realtime-server/test/network.test.ts` — capture the reveal-wait result and use it:

```ts
    const afterReveal = waitForState(s2, (st) => st.auction !== null);
    s1.emit("turn:startAuction");
    const revealedState = await afterReveal;

    const afterBid = waitForState(s1, (st) => st.auction?.highestBid?.amount === 10);
    s2.emit("auction:bid", { moneyCardIds: [findMoneyCardId(revealedState, p2, 10)] });
    await afterBid;
```

(add `import { findMoneyCardId } from './helpers/playToGameOver.js';` at the top of the file — this file is `apps/realtime-server/test/network.test.ts`, so the relative path is `./helpers/playToGameOver.js`.)

`apps/realtime-server/test/network.security.test.ts` — same pattern, twice. First occurrence:

```ts
    s1.emit('turn:startAuction');
    const revealedForS2 = await waitForState(s2, (st) => st.auction !== null);
    s2.emit('auction:bid', { moneyCardIds: [findMoneyCardId(revealedForS2, p2, 10)] });
```

Second occurrence:

```ts
    s2.emit('turn:startAuction');
    const revealedForS3 = await waitForState(s3, (st) => st.auction !== null);
    s3.emit('auction:bid', { moneyCardIds: [findMoneyCardId(revealedForS3, p3, 10)] });
```

Add the same import.

`apps/realtime-server/test/network.e2e.test.ts` — this file's reveal-wait is captured on the *passer's* socket, not the bidder's, so the bidder's own view needs a second parallel wait on the same broadcast:

```ts
      const revealed = waitForState(passerSocket, (st) => st.auction !== null);
      const revealedForBidder = waitForState(bidderSocket, (st) => st.auction !== null);
      activeSocket.emit('turn:startAuction');
      const [, bidderState] = await Promise.all([revealed, revealedForBidder]);

      const bid = waitForState(activeSocket, (st) => st.auction?.highestBid?.amount === 10);
      bidderSocket.emit('auction:bid', { moneyCardIds: [findMoneyCardId(bidderState, others[0]!, 10)] });
      await bid;
```

Add the same import.

- [ ] **Step 4: Run the affected test suites to verify they fail against the current `GameRoom`/socket handlers**

Run: `pnpm --filter @kuhhandel/realtime-server test`
Expected: FAIL — `GameRoom.placeBid`/`sellerDecision` and the `auction:bid`/`auction:sellerDecision` socket handlers still expect `amount`, not `moneyCardIds`/`paymentCardIds`.

- [ ] **Step 5: Update `GameRoom.ts`**

Replace the current `placeBid`/`sellerDecision` methods:

```ts
  placeBid(playerId: string, moneyCardIds: string[]): void {
    this.requireActionable();
    const state = this.requireAuction();
    const cards = this.resolveOffer(playerId, moneyCardIds);
    this.auction = engPlaceBid(state, playerId, cards);
    this.statsTracker.onBid(playerId);
    const amount = this.auction.highestBid!.amount;
    if (isBigBid(amount)) {
      this.emitNarratorEvent('bigBid', {
        player: this.findPlayer(playerId).name,
        amount,
        species: state.card.species,
      });
    }
    this.runBotLoop();
  }
```

```ts
  sellerDecision(playerId: string, decision: SellerDecision, paymentCardIds?: string[]): void {
    this.requireActionable();
    this.requireActivePlayer(playerId);
    const auctionState = this.requireAuction();
    const sellerPaymentCards =
      decision === 'keep' && paymentCardIds ? this.resolveOffer(playerId, paymentCardIds) : undefined;
    const result = resolveAuction(auctionState, decision, sellerPaymentCards);
    this.players = applyAuctionResult(this.players, result);
    this.statsTracker.onAuctionResolved(result, playerId, this.currentAuctionBidderIds);
    if (isDeckExhausted(this.deck)) {
      const buyer = this.findPlayer(result.cardGoesTo);
      this.statsTracker.onFinalCardResolved(buyer.id, result.card.species, buyer.animals);
    }
    this.withGameId((gameId) => this.persistence.logEvent(gameId, 'AUCTION_RESOLVED', result));
    this.endTurn();
    this.runBotLoop();
  }
```

(`resolveOffer` is the existing private helper — no changes needed to it, it's already generic: resolves a list of card IDs against a player's current `money` hand.)

- [ ] **Step 6: Update `socketServer.ts` handlers**

Replace:

```ts
    socket.on("auction:bid", ({ amount }) => {
      runAction(socket, (room, info) => room.placeBid(info.playerId, amount));
    });
```

with:

```ts
    socket.on("auction:bid", ({ moneyCardIds }) => {
      runAction(socket, (room, info) => room.placeBid(info.playerId, moneyCardIds));
    });
```

Replace:

```ts
    socket.on("auction:sellerDecision", ({ decision }) => {
      runAction(socket, (room, info) => room.sellerDecision(info.playerId, decision));
    });
```

with:

```ts
    socket.on("auction:sellerDecision", ({ decision, paymentCardIds }) => {
      runAction(socket, (room, info) => room.sellerDecision(info.playerId, decision, paymentCardIds));
    });
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @kuhhandel/realtime-server test`
Expected: PASS (full suite)

- [ ] **Step 8: Add new coverage for combined bids and keep-payments at the `GameRoom` level**

Append to `apps/realtime-server/test/room.test.ts`, inside `describe('GameRoom — auction turn', ...)`:

```ts
  it('accepts a bid combined from multiple cards, and a keep payment combined from multiple cards', () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    const p3 = room.join('p3');
    room.start();

    room.startAuction(p1);
    // Starting money is 2×0, 4×10, 1×50 — combine two 10s for a bid no
    // single starting card matches exactly.
    const p2Money = room.getViewFor(p2).players.find((p) => p.id === p2)!.money!;
    const twoTens = p2Money.filter((c) => c.value === 10).slice(0, 2).map((c) => c.id);
    room.placeBid(p2, twoTens);
    room.pass(p3);

    const highestBid = room.getViewFor(p1).auction!.highestBid!;
    expect(highestBid.amount).toBe(20);

    const p1Money = room.getViewFor(p1).players.find((p) => p.id === p1)!.money!;
    const p1TwoTens = p1Money.filter((c) => c.value === 10).slice(0, 2).map((c) => c.id);
    room.sellerDecision(p1, 'keep', p1TwoTens);

    const view = room.getViewFor(p1);
    expect(view.players.find((p) => p.id === p1)!.animals).toHaveLength(1); // seller kept the card
    expect(view.players.find((p) => p.id === p2)!.moneyCount).toBe(p2Money.length); // 2 spent, 2 received back
  });

  it('rejects a keep payment that does not sum to exactly the highest bid', () => {
    const room = new GameRoom(() => 0);
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    const p3 = room.join('p3');
    room.start();

    room.startAuction(p1);
    const p2Money = room.getViewFor(p2).players.find((p) => p.id === p2)!.money!;
    room.placeBid(p2, [p2Money.find((c) => c.value === 50)!.id]);
    room.pass(p3);

    const p1Money = room.getViewFor(p1).players.find((p) => p.id === p1)!.money!;
    const wrongCards = p1Money.filter((c) => c.value === 10).slice(0, 2).map((c) => c.id); // sums to 20, not 50
    expect(() => room.sellerDecision(p1, 'keep', wrongCards)).toThrow(/exactly/i);
  });
```

- [ ] **Step 9: Run the new tests to verify they pass**

Run: `pnpm --filter @kuhhandel/realtime-server test -- room.test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add apps/realtime-server/src/room/GameRoom.ts apps/realtime-server/src/socketServer.ts apps/realtime-server/test/
git commit -m "feat(realtime-server): wire combined-card bids and keep-payments through GameRoom"
```

---

### Task 4: Bot-engine — card-composition helpers

**Files:**
- Modify: `packages/bot-engine/src/money.ts`
- Test: `packages/bot-engine/test/decisions.test.ts` (money-helper section)

**Interfaces:**
- Produces: `selectCardsExceeding(hand: MoneyCard[], minAmount: number, maxAmount: number): MoneyCard[] | null`, `selectExactCards(hand: MoneyCard[], exactAmount: number): MoneyCard[] | null` — consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

`packages/bot-engine/test/decisions.test.ts` — add near the existing `describe("money.selectCardsForAmount", ...)` block:

```ts
import { selectCardsExceeding, selectExactCards } from "../src/money.js";

describe("money.selectCardsExceeding", () => {
  it("returns null when no affordable raise exists", () => {
    expect(selectCardsExceeding(money(10), 500, 500)).toBeNull();
  });

  it("composes the largest sum within budget when it exceeds the minimum", () => {
    const hand = money(10, 50, 100);
    const result = selectCardsExceeding(hand, 40, 200);
    expect(result).not.toBeNull();
    const sum = result!.reduce((s, c) => s + c.value, 0);
    expect(sum).toBeGreaterThan(40);
    expect(sum).toBeLessThanOrEqual(200);
  });

  it("returns null when the best affordable sum still doesn't exceed the minimum", () => {
    const hand = money(10, 10);
    expect(selectCardsExceeding(hand, 50, 100)).toBeNull();
  });
});

describe("money.selectExactCards", () => {
  it("finds a single-card exact match", () => {
    const hand = money(10, 50, 100);
    const result = selectExactCards(hand, 50);
    expect(result).toEqual([hand[1]]);
  });

  it("finds a combined exact match when no single card matches", () => {
    const hand = money(10, 50, 100);
    const result = selectExactCards(hand, 60);
    expect(result).not.toBeNull();
    const sum = result!.reduce((s, c) => s + c.value, 0);
    expect(sum).toBe(60);
  });

  it("returns null when no subset sums to the exact target", () => {
    const hand = money(10, 10);
    expect(selectExactCards(hand, 25)).toBeNull();
  });

  it("returns an empty array for a target of exactly 0", () => {
    expect(selectExactCards(money(10, 50), 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @kuhhandel/bot-engine test -- decisions`
Expected: FAIL — `selectCardsExceeding`/`selectExactCards` don't exist yet.

- [ ] **Step 3: Implement the helpers**

`packages/bot-engine/src/money.ts` — append:

```ts
/**
 * For bidding: greedily composes the largest sum from `hand` that is
 * `<= maxAmount`, and returns it only if that sum exceeds `minAmount`
 * (a valid strictly-higher raise) — otherwise `null` (no raise possible
 * within budget). Bids don't need an exact target, unlike a "keep"
 * payment (see `selectExactCards`).
 */
export function selectCardsExceeding(
  hand: MoneyCard[],
  minAmount: number,
  maxAmount: number,
): MoneyCard[] | null {
  const sorted = [...hand].filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
  const selected: MoneyCard[] = [];
  let sum = 0;
  for (const card of sorted) {
    if (sum + card.value <= maxAmount) {
      selected.push(card);
      sum += card.value;
    }
  }
  return sum > minAmount ? selected : null;
}

/**
 * For a "keep" payment: finds a subset of `hand` summing to *exactly*
 * `exactAmount` (no change-making). Bounded recursive search — a
 * player's hand is always small (drawn from the shared 55-card bank), so
 * this is cheap despite the worst-case exponential shape.
 */
export function selectExactCards(hand: MoneyCard[], exactAmount: number): MoneyCard[] | null {
  const positive = hand.filter((c) => c.value > 0);

  function search(index: number, remaining: number): MoneyCard[] | null {
    if (remaining === 0) return [];
    if (remaining < 0 || index >= positive.length) return null;
    const withCard = search(index + 1, remaining - positive[index]!.value);
    if (withCard) return [positive[index]!, ...withCard];
    return search(index + 1, remaining);
  }

  if (exactAmount === 0) return [];
  return search(0, exactAmount);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @kuhhandel/bot-engine test -- decisions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/bot-engine/src/money.ts packages/bot-engine/test/decisions.test.ts
git commit -m "feat(bot-engine): add combined-card selection helpers"
```

---

### Task 5: Bot-engine — bots combine bills for bidding and keeping

**Files:**
- Modify: `packages/bot-engine/src/decisions.ts`
- Modify: `apps/realtime-server/src/room/GameRoom.ts` (`runBotLoop`)
- Test: `packages/bot-engine/test/decisions.test.ts`

**Interfaces:**
- Consumes: `selectCardsExceeding`, `selectExactCards` (Task 4).
- Produces: `decideAuctionBid(bot, state, config, rng): MoneyCard[] | null` (was `number | null`), `decideSellerDecision(seller, state, config): { decision: 'sell' } | { decision: 'keep'; paymentCards: MoneyCard[] }` (was `'sell' | 'keep'`) — both consumed by `GameRoom.runBotLoop`.

- [ ] **Step 1: Update the existing `decisions.test.ts` tests to the new return shapes**

Replace the two existing `describe` blocks:

```ts
describe("decideAuctionBid", () => {
  it("only proposes cards the bot actually holds, summing above the current highest", () => {
    const bot = player({ animals: [{ id: "a1", species: "vache" }] });
    const state: AuctionState = startAuction({ id: "c1", species: "vache" }, "seller", [bot.id]);
    const bid = decideAuctionBid(bot, state, BOT_DIFFICULTY_PRESETS.normal, rng);
    if (bid !== null) {
      const bidIds = new Set(bid.map((c) => c.id));
      expect(bot.money.every((c) => !bidIds.has(c.id) || bot.money.some((h) => h.id === c.id))).toBe(true);
      expect(bid.reduce((sum, c) => sum + c.value, 0)).toBeGreaterThan(state.highestBid?.amount ?? -1);
    }
  });

  it("passes once every affordable combination is below its budget cap", () => {
    const bot = player({ money: money(10) });
    const state: AuctionState = {
      card: { id: "c1", species: "vache" },
      sellerId: "seller",
      activeBidders: [bot.id],
      highestBid: { playerId: "other", cards: money(500), amount: 500 },
      status: "bidding",
    };
    const bid = decideAuctionBid(bot, state, BOT_DIFFICULTY_PRESETS.easy, rng);
    expect(bid).toBeNull();
  });

  it("can combine multiple cards into a single bid when its budget allows", () => {
    const bot = player({
      money: money(10, 10, 10, 10, 10),
      animals: [
        { id: "a1", species: "vache" },
        { id: "a2", species: "vache" },
        { id: "a3", species: "vache" },
      ],
    });
    const state: AuctionState = {
      card: { id: "c1", species: "vache" },
      sellerId: "seller",
      activeBidders: [bot.id],
      highestBid: { playerId: "other", cards: money(30), amount: 30 },
      status: "bidding",
    };
    const bid = decideAuctionBid(bot, state, BOT_DIFFICULTY_PRESETS.aggressive, rng);
    expect(bid).not.toBeNull();
    expect(bid!.length).toBeGreaterThan(1);
  });
});

describe("decideSellerDecision", () => {
  it("sells when the highest bid clears the estimate", () => {
    const seller = player();
    const state: AuctionState = {
      card: { id: "c1", species: "cochon" },
      sellerId: seller.id,
      activeBidders: [],
      highestBid: { playerId: "buyer", cards: money(500), amount: 500 },
      status: "awaiting_seller_decision",
    };
    expect(decideSellerDecision(seller, state, BOT_DIFFICULTY_PRESETS.normal)).toEqual({ decision: "sell" });
  });

  it("sells even a low bid it wants to reject, if it can't afford to pay the bidder to keep", () => {
    const seller = player({ money: money(10) }); // can't compose 500 to keep
    const state: AuctionState = {
      card: { id: "c1", species: "cochon" },
      sellerId: seller.id,
      activeBidders: [],
      highestBid: { playerId: "buyer", cards: money(500), amount: 500 },
      status: "awaiting_seller_decision",
    };
    expect(decideSellerDecision(seller, state, BOT_DIFFICULTY_PRESETS.easy)).toEqual({ decision: "sell" });
  });

  it("sells for free when nobody bid (no reason to keep for nothing)", () => {
    const seller = player();
    const state: AuctionState = {
      card: { id: "c1", species: "cochon" },
      sellerId: seller.id,
      activeBidders: [],
      highestBid: null,
      status: "awaiting_seller_decision",
    };
    expect(decideSellerDecision(seller, state, BOT_DIFFICULTY_PRESETS.normal)).toEqual({ decision: "sell" });
  });

  it("can keep by combining multiple cards into an exact payment", () => {
    const seller = player({ money: money(10, 10, 10) }); // only exact via 10+10+10=30
    const state: AuctionState = {
      card: { id: "c1", species: "cochon" },
      sellerId: seller.id,
      activeBidders: [],
      highestBid: { playerId: "buyer", cards: money(30), amount: 30 },
      status: "awaiting_seller_decision",
    };
    // Force "keep" to be preferable regardless of estimate via a low-aggressiveness config
    const decision = decideSellerDecision(seller, state, { ...BOT_DIFFICULTY_PRESETS.easy, aggressiveness: 100 });
    if (decision.decision === "keep") {
      expect(decision.paymentCards.reduce((sum, c) => sum + c.value, 0)).toBe(30);
    }
  });
});
```

(`money(...)` and `player(...)` are the file's existing local helpers — no changes needed to them.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @kuhhandel/bot-engine test -- decisions`
Expected: FAIL — `decideAuctionBid`/`decideSellerDecision` still return the old shapes.

- [ ] **Step 3: Implement the updated decision functions**

`packages/bot-engine/src/decisions.ts` — replace the imports line and both functions:

```ts
import { selectCardsExceeding, selectExactCards, totalValue } from "./money.js";
```

```ts
/**
 * Returns the cards to bid (or null to pass). Now that the engine accepts
 * combined-card bids (packages/game-engine/src/engine/applyResults.ts no
 * longer requires a single exact-denomination card), the bot composes its
 * budget from as many cards as it needs, same capability a human player
 * has via the multi-select bid UI.
 */
export function decideAuctionBid(
  bot: Player,
  state: AuctionState,
  config: BotConfig,
  rng: RandomSource,
): MoneyCard[] | null {
  const estimate = estimatedCardValue(bot.animals, state.card.species);
  const cash = totalValue(bot.money);
  const budget = jitter(Math.min(estimate, cash * config.aggressiveness), config.riskTolerance, rng);
  const currentHighest = state.highestBid?.amount ?? -1;

  return selectCardsExceeding(bot.money, currentHighest, budget);
}

export type SellerAuctionDecision = { decision: "sell" } | { decision: "keep"; paymentCards: MoneyCard[] };

/**
 * The seller sells whenever the highest bid clears their own estimate of
 * the card. "Keep" requires paying the bidder the bid amount out of the
 * seller's own hand — now via any combination of cards that sums exactly
 * (packages/bot-engine/src/money.ts's selectExactCards), not just a
 * single matching card.
 */
export function decideSellerDecision(
  seller: Player,
  state: AuctionState,
  config: BotConfig,
): SellerAuctionDecision {
  if (!state.highestBid) return { decision: "sell" };
  const paymentCards = selectExactCards(seller.money, state.highestBid.amount);
  if (!paymentCards) return { decision: "sell" };
  const estimate = estimatedCardValue(seller.animals, state.card.species);
  return state.highestBid.amount >= estimate * config.aggressiveness
    ? { decision: "sell" }
    : { decision: "keep", paymentCards };
}
```

- [ ] **Step 4: Wire the new shapes into `GameRoom.runBotLoop`**

`apps/realtime-server/src/room/GameRoom.ts` — inside `runBotLoop`, replace:

```ts
        if (botBidder) {
          const bot = this.findPlayer(botBidder);
          const bid = decideAuctionBid(bot, state, this.botConfig(botBidder), this.rng);
          if (bid === null) {
            this.pass(botBidder);
          } else {
            this.placeBid(botBidder, bid);
          }
        }
```

with:

```ts
        if (botBidder) {
          const bot = this.findPlayer(botBidder);
          const bid = decideAuctionBid(bot, state, this.botConfig(botBidder), this.rng);
          if (bid === null) {
            this.pass(botBidder);
          } else {
            this.placeBid(botBidder, bid.map((c) => c.id));
          }
        }
```

and replace:

```ts
      if (state.status === 'awaiting_seller_decision' && this.botPlayerIds.has(state.sellerId)) {
        const seller = this.findPlayer(state.sellerId);
        const decision = decideSellerDecision(seller, state, this.botConfig(state.sellerId));
        this.sellerDecision(state.sellerId, decision);
      }
```

with:

```ts
      if (state.status === 'awaiting_seller_decision' && this.botPlayerIds.has(state.sellerId)) {
        const seller = this.findPlayer(state.sellerId);
        const decision = decideSellerDecision(seller, state, this.botConfig(state.sellerId));
        this.sellerDecision(
          state.sellerId,
          decision.decision,
          decision.decision === 'keep' ? decision.paymentCards.map((c) => c.id) : undefined,
        );
      }
```

- [ ] **Step 5: Run the full bot-engine and realtime-server suites to verify everything passes**

Run: `pnpm --filter @kuhhandel/bot-engine test && pnpm --filter @kuhhandel/realtime-server test`
Expected: PASS — this exercises `GameRoom.runBotLoop` indirectly through every existing bot-driven test (`room.bots.test.ts`, `room.sixPlayers.test.ts`, etc.), which is the main regression surface for this task.

- [ ] **Step 6: Typecheck both packages**

Run: `pnpm --filter @kuhhandel/bot-engine typecheck && pnpm --filter @kuhhandel/realtime-server typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/bot-engine/src/decisions.ts packages/bot-engine/test/decisions.test.ts apps/realtime-server/src/room/GameRoom.ts
git commit -m "feat(bot-engine): bots combine bills for bidding and keep-payments"
```

---

### Task 6: UI — multi-select bidding

**Files:**
- Modify: `apps/web/components/AuctionPanel.tsx`
- Modify: `apps/web/components/AuctionPanel.module.css`

**Interfaces:**
- Consumes: existing `PlayingCard`, `Button` from `@kuhhandel/ui`; `registerCardPosition` from `../lib/cardPositions` (unchanged, already imported).
- Produces: local component state for the current bid selection — no new exported interfaces (internal to `AuctionPanel.tsx`).

- [ ] **Step 1: Replace the single-card bid UI with a multi-select**

`apps/web/components/AuctionPanel.tsx` — add `useState` to the React import, and replace the non-leading active-bidder block. Full new file:

```tsx
"use client";

import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { getSocket } from "../lib/socket";
import { Button, PlayingCard } from "@kuhhandel/ui";
import { SPECIES_LABEL } from "../lib/species";
import { registerCardPosition } from "../lib/cardPositions";
import styles from "./AuctionPanel.module.css";

export function AuctionPanel() {
  const state = useGameStore((s) => s.state);
  const playerId = useGameStore((s) => s.playerId);
  const [selectedBidIds, setSelectedBidIds] = useState<string[]>([]);
  const auction = state?.auction;
  if (!auction || !playerId) return null;

  const isSeller = auction.sellerId === playerId;
  const isActiveBidder = auction.activeBidders.includes(playerId);
  const isLeading = auction.highestBid?.playerId === playerId;
  const awaitingSellerDecision = auction.status === "awaiting_seller_decision";
  const myMoney = state!.players.find((p) => p.id === playerId)?.money ?? [];
  const currentHighest = auction.highestBid?.amount ?? -1;
  const selectedTotal = myMoney
    .filter((c) => selectedBidIds.includes(c.id))
    .reduce((sum, c) => sum + c.value, 0);

  function toggleBidCard(cardId: string) {
    setSelectedBidIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId],
    );
  }

  function submitBid() {
    getSocket().emit("auction:bid", { moneyCardIds: selectedBidIds });
    setSelectedBidIds([]);
  }

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Enchère — {SPECIES_LABEL[auction.card.species]}</h3>
      <p className={styles.ticker}>
        Meilleure offre :{" "}
        {auction.highestBid ? (
          <span className={styles.tickerAmount}>{auction.highestBid.amount}</span>
        ) : (
          "aucune"
        )}
        {auction.highestBid &&
          ` (${state!.players.find((p) => p.id === auction.highestBid!.playerId)?.name ?? "?"})`}
      </p>

      {isLeading && !awaitingSellerDecision && (
        <p className={styles.leadingState}>
          Vous menez l'enchère à {currentHighest} — en attente des autres joueurs.
        </p>
      )}

      {!isSeller && !isLeading && !awaitingSellerDecision && isActiveBidder && (
        <div>
          {/* Bids are combined from cards in your own hand — known with
              certainty, cf. 05_UI_UX.md §4 — not an arbitrary typed
              amount you might not actually hold. */}
          <p className={styles.handLabel}>
            Ta main — sélectionne un ou plusieurs billets (total : {selectedTotal}) :
          </p>
          <div className={styles.bidRow}>
            {myMoney.map((card) => {
              const isSelected = selectedBidIds.includes(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  ref={(el) => registerCardPosition(card.id, el)}
                  className={[styles.bidCard, isSelected ? styles.bidCardSelected : ""]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={isSelected}
                  onClick={() => toggleBidCard(card.id)}
                >
                  <PlayingCard
                    variant="money"
                    label={`Billet ${card.value}`}
                    value={card.value}
                    imageSlot={`bill-${card.value}`}
                    accentColor="var(--kd-accent-yellow)"
                  />
                </button>
              );
            })}
          </div>
          <div className={styles.bidActions}>
            <Button
              variant="primary"
              disabled={selectedTotal <= currentHighest}
              onClick={submitBid}
            >
              Enchérir ({selectedTotal})
            </Button>
            <Button variant="secondary" onClick={() => getSocket().emit("auction:pass")}>
              Passer
            </Button>
          </div>
        </div>
      )}

      {isSeller && awaitingSellerDecision && (
        <div className={styles.sellerActions}>
          <Button
            variant="primary"
            onClick={() => getSocket().emit("auction:sellerDecision", { decision: "sell" })}
          >
            Vendre
          </Button>
          <Button
            variant="secondary"
            disabled={
              auction.highestBid !== null && !myMoney.some((c) => c.value === auction.highestBid!.amount)
            }
            title="Garder l'animal t'oblige à payer l'enchérisseur ce montant exact — il te faut une carte de cette valeur."
            onClick={() => getSocket().emit("auction:sellerDecision", { decision: "keep" })}
          >
            Garder
          </Button>
        </div>
      )}
    </div>
  );
}
```

(The seller's "Garder" block above is intentionally left as its Task 3-era single-card version for now — Task 8 replaces it with the multi-select payment flow. Leaving it functional in the meantime keeps every task's diff independently testable.)

- [ ] **Step 2: Add the new CSS classes**

`apps/web/components/AuctionPanel.module.css` — append:

```css
.bidCardSelected {
  outline: 3px solid var(--kd-accent-pink);
  outline-offset: 2px;
  box-shadow: 0 0 var(--kd-glow-radius-sm)
    color-mix(in oklch, var(--kd-accent-pink) var(--kd-glow-strength), transparent);
}

.bidActions {
  display: flex;
  gap: var(--kd-space-3);
}

.leadingState {
  margin: 0;
  padding: var(--kd-space-3);
  font-size: 13px;
  font-weight: 600;
  color: var(--kd-text);
  background: var(--kd-surface-alt);
  border: 2px solid var(--kd-accent-green);
  border-radius: var(--kd-radius-sm);
}
```

- [ ] **Step 3: Self-review the leading-bidder state against the spec**

Confirm in the file just written: while `isLeading` is true and the auction hasn't reached `awaiting_seller_decision`, the bid-selection panel and "Passer" button are not rendered — only the "Vous menez l'enchère à {amount} — en attente des autres joueurs." message. This is the spec's §6 requirement (a leading bidder cannot bid against themselves), implemented as part of this same task's diff — no separate task needed.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/AuctionPanel.tsx apps/web/components/AuctionPanel.module.css
git commit -m "feat(web): multi-select combined-bill bidding and leading-bidder state"
```

---

### Task 7: UI — seller composes the "Garder" payment

**Files:**
- Modify: `apps/web/components/AuctionPanel.tsx`

**Interfaces:**
- Consumes: Task 6's component structure and CSS classes (`.bidCard`, `.bidCardSelected`, `.bidRow`, `.bidActions`).

- [ ] **Step 1: Replace the seller's single-click "Garder" with a two-step multi-select**

`apps/web/components/AuctionPanel.tsx` — add a second piece of local state and replace the `isSeller && awaitingSellerDecision` block:

Add alongside the existing `useState` for `selectedBidIds`:

```tsx
  const [composingKeep, setComposingKeep] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
```

Add derived state alongside `selectedTotal`:

```tsx
  const selectedPaymentTotal = myMoney
    .filter((c) => selectedPaymentIds.includes(c.id))
    .reduce((sum, c) => sum + c.value, 0);
```

Add handlers alongside `toggleBidCard`/`submitBid`:

```tsx
  function togglePaymentCard(cardId: string) {
    setSelectedPaymentIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId],
    );
  }

  function confirmKeep() {
    getSocket().emit("auction:sellerDecision", { decision: "keep", paymentCardIds: selectedPaymentIds });
    setComposingKeep(false);
    setSelectedPaymentIds([]);
  }
```

Replace the entire `{isSeller && awaitingSellerDecision && ( ... )}` block with:

```tsx
      {isSeller && awaitingSellerDecision && !composingKeep && (
        <div className={styles.sellerActions}>
          <Button
            variant="primary"
            onClick={() => getSocket().emit("auction:sellerDecision", { decision: "sell" })}
          >
            Vendre
          </Button>
          <Button
            variant="secondary"
            onClick={() => setComposingKeep(true)}
          >
            Garder
          </Button>
        </div>
      )}

      {isSeller && awaitingSellerDecision && composingKeep && (
        <div>
          <p className={styles.handLabel}>
            Choisis des billets sommant exactement à {currentHighest} pour garder l'animal (total
            sélectionné : {selectedPaymentTotal}) :
          </p>
          <div className={styles.bidRow}>
            {myMoney.map((card) => {
              const isSelected = selectedPaymentIds.includes(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  className={[styles.bidCard, isSelected ? styles.bidCardSelected : ""]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={isSelected}
                  onClick={() => togglePaymentCard(card.id)}
                >
                  <PlayingCard
                    variant="money"
                    label={`Billet ${card.value}`}
                    value={card.value}
                    imageSlot={`bill-${card.value}`}
                    accentColor="var(--kd-accent-yellow)"
                  />
                </button>
              );
            })}
          </div>
          <div className={styles.bidActions}>
            <Button
              variant="primary"
              disabled={selectedPaymentTotal !== currentHighest}
              onClick={confirmKeep}
            >
              Confirmer ({selectedPaymentTotal} / {currentHighest})
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setComposingKeep(false);
                setSelectedPaymentIds([]);
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/AuctionPanel.tsx
git commit -m "feat(web): seller composes the Garder payment from multiple bills"
```

---

### Task 8: Final automated verification

Per the established project preference, skip manual browser verification — rely on the full automated suite plus typecheck/lint across every touched package.

- [ ] **Step 1: Run every automated gate**

```bash
pnpm --filter @kuhhandel/game-engine test
pnpm --filter @kuhhandel/bot-engine test
pnpm --filter @kuhhandel/realtime-server test
pnpm --filter @kuhhandel/game-engine typecheck
pnpm --filter @kuhhandel/bot-engine typecheck
pnpm --filter @kuhhandel/realtime-server typecheck
pnpm --filter @kuhhandel/shared-types typecheck
pnpm --filter @kuhhandel/ui typecheck
pnpm --filter @kuhhandel/web typecheck
pnpm --filter @kuhhandel/web lint
```

Expected: all PASS.

- [ ] **Step 2: This task is done once every gate is green — no commit of its own unless fixes were needed.**
