# Auction Bidding Improvements — Design

## Background

Playtesting surfaced two gaps in the auction bidding flow (`apps/web/components/AuctionPanel.tsx`):

1. **No way to combine bills into a bid.** Bidding is currently limited to
   clicking exactly one money card from your hand — its face value becomes
   the bid. There is no way to bid an amount that requires combining
   several bills (e.g. a 10 + a 50 to bid 60).
2. **No feedback on currently leading the auction.** Once a player becomes
   the highest bidder, the panel gives no distinct visual state — the bid
   panel and "Passer" button stay exactly as before, so a leading bidder
   can't tell they're winning without reading the ticker line carefully,
   and nothing stops them from bidding against themselves.

Gap 1 is not purely a UI choice. `packages/game-engine/src/engine/applyResults.ts`
documents it directly:

```
Simplification (Phase 1 scope): the engine does not simulate making
change for bids that don't match an exact denomination in hand —
real gameplay requires the payer to compose the amount from their
cards, which is a player/UI concern, not a core rule enforced here.
```

`transferExactMoneyCard` looks for a single card of the exact bid amount
in the payer's hand and **throws** if none exists. The UI's single-card
restriction is a workaround for this engine limitation, not an
independent design choice.

## Goals

- A player can bid an amount composed of multiple money cards from their
  hand, not just a single card's face value.
- The engine pays out the winning bid using the exact set of cards the
  bidder selected — no more "no single card of exact value" crash risk.
- A player who currently holds the highest bid sees a clear, distinct
  "you are leading" state, and cannot place a further (redundant) bid
  against themselves while leading.

## Non-goals

- No change to Kuhhandel bidding/offer mechanics (separate sub-project).
- No change to the auction's core rules (strict-increase bidding, seller
  sell/keep decision, no-bid behavior) — only how a bid amount is composed
  and displayed.
- No "make change" logic (e.g. bidding 55 with a single 60 bill and
  receiving 5 back) — a bid's value must still be reachable exactly by
  summing a subset of the bidder's own cards.

## Design

### 1. Engine: bids reference specific cards, not just an amount

`packages/game-engine/src/auction/auction.ts`:

- `Bid` becomes `{ playerId: string; cardIds: string[]; amount: number }`.
  `amount` stays a derived, denormalized field (sum of the referenced
  cards) so existing amount-based comparisons/display logic elsewhere in
  the codebase don't need to change.
- `placeBid(state, playerId, cardIds, holderCards)` (signature grows to
  take the bidder's current hand, mirroring how `submitInitiatorOffer`'s
  caller in `GameRoom.ts` resolves card IDs to `MoneyCard[]` before
  calling into the engine — see `resolveOffer` in `GameRoom.ts`) resolves
  `cardIds` to `MoneyCard[]`, sums their values into `amount`, and applies
  the existing strict-increase validation against `state.highestBid.amount`.
  Throws if any `cardId` doesn't belong to the bidder (same style of error
  as `resolveOffer`'s "does not hold money card" check).
- No cards are removed from the bidder's hand at bid time — same as the
  Kuhhandel offer flow, cards only move at resolution. A player who bids
  again (still active, not yet outbid) or is outbid simply has their
  previous `Bid` overwritten/discarded by `AuctionState.highestBid`
  pointing at the new one; no cleanup needed.

### 2. Engine: resolution pays with the exact bid cards

`packages/game-engine/src/engine/applyResults.ts`:

- `transferExactMoneyCard` (the single-card, exact-denomination lookup) is
  replaced by a direct transfer of the winning bid's `cardIds` — the same
  `transferMoneyCards(players, fromId, toId, cards)` helper already used
  by `applyKuhhandelResult`. `AuctionResult.payment` gains a `cards:
  MoneyCard[]` field (populated from the winning `Bid.cardIds`) alongside
  the existing `amount`, so `applyAuctionResult` no longer needs to search
  the payer's hand at resolution time — it already knows exactly which
  cards to move.
- This fully removes the crash path: a bid is only ever accepted if its
  cards genuinely belong to the bidder and sum to the bid amount, so
  resolution can never fail to find a matching card.

### 3. Wire type: `AuctionState.highestBid` gains `cardIds`

`packages/shared-types` re-exports `AuctionState` as-is from
`game-engine` (`GameRoom.getViewFor` sends `auction: this.auction`
unredacted, same as today) — so `highestBid.cardIds: string[]` becomes
visible to every player, not just the bidder. This is safe: money card
IDs (`bank-money-<n>`) don't encode their value, and the bid *amount* is
already fully public today (real Kuhhandel auctions are public — every
player always knows the current highest bid). No new information is
leaked; opponents already learn the amount, they just can't derive a
value from an ID alone.

### 4. UI: multi-select bidding

`apps/web/components/AuctionPanel.tsx`, for an active bidder who is not
currently leading:

- Replace the per-card bid button with a checkbox-style multi-select,
  reusing `KuhhandelPanel.tsx`'s `MoneyPicker` visual pattern (selectable
  `PlayingCard` money cards, toggled on click, running total displayed).
- A single "Enchérir" button submits the selection via
  `getSocket().emit("auction:bid", { moneyCardIds: selectedIds })`,
  enabled only when the running total strictly exceeds
  `auction.highestBid?.amount ?? -1`.
- "Passer" stays as today for a non-leading active bidder.

### 5. UI: leading-bidder state

Same file — when `auction.highestBid?.playerId === playerId`:

- The bid-selection panel and "Passer" button are not rendered.
- In their place: a message such as "Vous menez l'enchère à {amount} —
  en attente des autres joueurs." (exact copy can be refined during
  implementation, consistent with the file's existing French tone).

## Testing

`apps/realtime-server`/`packages/game-engine` have real Vitest suites —
standard TDD for the engine changes:

- Single-card bid still works (regression case for existing behavior).
- Multi-card bid: sum computed correctly, strictly-greater validation
  still enforced.
- Bid referencing a card the player doesn't hold throws.
- Resolution transfers exactly the winning bid's cards, for both single-
  and multi-card winning bids.
- No-bid / seller-keeps paths are unaffected (regression coverage).

`apps/web`/`packages/ui` have no test runner (unchanged from prior work)
— verification is manual: place a combined bid, confirm it registers and
displays correctly; confirm the leading-bidder state appears and blocks
further bidding from that player; confirm resolution pays with the
correct cards (self and after being outbid).

## Open questions / risks

- Exact French copy for the "vous menez" message is not finalized —
  refine during implementation, matching the file's existing tone.
- If a future task wants opponents' committed bid cards visually
  distinguished in their hand (e.g. a "reserved" badge), that's out of
  scope here — this spec only makes the bid amount composable, not the
  in-hand card display.
