# Gameplay Feedback & Visual Polish — Design

## Background

Post-launch play-testing of the corrected rules engine (see
`docs/superpowers/specs/2026-07-29-kuhhandel-rules-engine-correctness-design.md`)
surfaced three UI/UX gaps, all about game events being illegible to players:

1. **No persistent record of what just happened.** `narratorFeed`/`ToastNarrator`
   exists but only covers 4 flavor-text triggers (`bigBid`, `bluffRevealed`,
   `boldKuhhandel`, `comeback`) and shows only the single latest message,
   transiently. There is no event for auction resolution (who bought, at what
   price), Kuhhandel resolution (who won, which animal), or golden donkey
   payouts (amount, to whom) — exactly the events players most need to track.
2. **No animation for card reveal or family completion.** `PlayingCard` renders
   statically; a freshly-drawn auction card and a just-completed 4-card family
   look identical to any other card.
3. **No per-species color identity.** `PlayingCard`'s `accentColor` is set by
   caller context (which panel, which opponent slot) rather than by species,
   so cards from the same family don't visually read as a set.

## Goals

- Every game-state-changing event (auction resolved, Kuhhandel resolved,
  golden donkey payout, family completed) is visible in a persistent,
  scrollable event feed — not just a transient toast.
- Card reveal (auction draw) and family completion (4-of-a-kind for one
  player) are animated.
- Money transfer and animal-card transfer between players are animated
  (cards/bills visually move from source to destination instead of
  appearing directly in the destination's hand).
- Every one of the 10 species has one fixed color, used everywhere that
  species' cards render (hand, auction, Kuhhandel panel, opponent summaries).

## Non-goals

- No changes to game-engine/realtime-server logic — this is `apps/web` and
  `packages/ui` only. Every event this spec surfaces already exists on the
  wire (`GameStateView`, socket events) or is a trivial diff of consecutive
  states (see Design §1).
- No redesign of existing layout/navigation — additive changes to existing
  panels, not a rebuild.
- No animation library dependency unless a design section explicitly
  requires it — prefer CSS keyframes/transitions, consistent with the
  existing codebase (no `framer-motion` etc. currently installed).

## Design

### 1. Event feed

**Source of truth:** most needed events are not new server data — they're
derivable client-side by diffing consecutive `GameStateView` snapshots
(already the pattern `latestNarratorMessage` uses today, just discarded
after one render instead of accumulated):

- **Auction resolved**: `state.auction` transitions from non-null to null
  while `state.deckCount` changes — the previous auction's `card`,
  `highestBid`, and `sellerId` are still available in the pre-transition
  state to compose "X a remporté [espèce] pour [montant]" (or "n'a rien payé"
  when `highestBid` was null).
- **Kuhhandel resolved**: `state.kuhhandel` transitions from non-null to
  null — the previous state's `initiatorId`/`targetId`/`species` compose
  "X et Y ont échangé [espèce]" (exact winner isn't in the public view by
  design — see §3 — so the message states the trade happened, not who
  "won"; §3 fixes the underlying visibility gap this event message would
  otherwise have to route around).
- **Golden donkey payout**: needs one new field on `GameStateView` (server
  work, small): `donkeyRevealCount: number` already exists in `GameRoom`
  (unused by the wire type) — expose it, and the client emits a payout
  event whenever it increments, using the known bonus sequence
  (50/100/200/500) to state the amount.
- **Family completed**: for each player, diff `animals` per species
  before/after a state update; when any player's count for a species
  crosses from `<4` to `4`, emit "X a complété la famille [espèce] !".

**UI:** a new `EventFeed` component in `packages/ui`, a scrollable panel
(newest at top, capped history — e.g. last 50 events, older ones simply
scroll out of the rendered list, not deleted from a growing array) added
to `GameTable.tsx`'s layout as a persistent sidebar (desktop) / collapsible
drawer (mobile — matches the existing responsive patterns already in this
codebase). `ToastNarrator` stays as-is for its 4 existing flavor-text
triggers (a lighter-weight, ephemeral complement) — the two systems are
not merged; the feed is the durable record, the toast is color commentary.

### 2. Animations

Two new keyframe animations, plain CSS (no new dependency), respecting the
existing sitewide `prefers-reduced-motion` override in `tokens.css` (already
applies globally — no per-animation opt-out needed):

- **Card flip**: `PlayingCard` gains an optional `revealing` prop; when
  true, renders a 3D flip transition (back face → front face) on mount,
  driven by a CSS `@keyframes` using `transform-style: preserve-3d` /
  `backface-visibility: hidden` (validated in the visual companion mockup).
  `GameTable.tsx` sets `revealing` on the auction card only for the render
  cycle immediately following `state.auction` transitioning from null to
  non-null (a one-shot flag, not a persistent state).
- **Family-complete glow**: a pulse + glow `@keyframes` applied to a
  player's 4 cards of a species the instant that species crosses to
  complete (same before/after diff as the event feed's family-completed
  detection — share the diffing logic, don't duplicate it). Plays once,
  then settles to a static (non-animated) highlighted state so a completed
  family stays visually distinct going forward (e.g. a persistent subtle
  border/glow at rest, using the species' own color from §3), not just a
  one-time flash.
- **Money transfer**: when a payment resolves (auction sale, Kuhhandel
  accept), the paid money card(s) animate a translate from the payer's
  hand position to the payee's, before settling into the destination
  hand's render.
- **Animal transfer**: same pattern for the animal card in an auction/
  Kuhhandel resolution — translates from seller/loser to buyer/winner
  instead of appearing directly.

Both transfer animations need the source and destination DOM positions at
the moment of transfer; implement via a shared small utility (e.g. FLIP-
technique using `getBoundingClientRect` diffs across the two renders) rather
than hand-rolling separate logic per transfer type — one utility, reused by
both.

### 3. Per-species color

New `SPECIES_COLOR: Record<SpeciesKey, string>` in `apps/web/lib/species.ts`
(same file that already holds `SPECIES_LABEL`/`SPECIES_IMAGE_SLOT`), using
these 10 OKLCH values (approved via the visual companion — 5 reuse existing
`--kd-accent-*` tokens, 5 are new hues in the same style):

| Species | Color |
|---|---|
| coq | `oklch(88% 0.19 45)` (= `--kd-accent-orange`) |
| oie | `oklch(88% 0.19 100)` (= `--kd-accent-yellow`) |
| chat | `oklch(70% 0.28 340)` (= `--kd-accent-pink`) |
| chien | `oklch(80% 0.16 200)` (= `--kd-accent-cyan`) |
| mouton | `oklch(72% 0.24 20)` (new) |
| chevre | `oklch(85% 0.22 70)` (new) |
| ane | `oklch(78% 0.27 140)` (= `--kd-accent-green`) |
| cochon | `oklch(68% 0.25 300)` (new) |
| vache | `oklch(68% 0.22 260)` (new) |
| cheval | `oklch(75% 0.20 170)` (new) |

The 5 new hues get their own `--kd-species-*` CSS custom properties in
`tokens.css` (not reusing the `--kd-accent-*` names, since those remain the
general-purpose "1-2 active per screen" UI accents per the existing
tokens.css comment — species colors are a separate, always-all-10-active
system). Every `<PlayingCard variant="animal" ...>` call site
(`GameTable.tsx`, `AuctionPanel.tsx`, `KuhhandelPanel.tsx`) switches its
`accentColor` prop from its current per-context value to
`SPECIES_COLOR[card.species]`. Money cards (`variant="money"`) are
unaffected — they keep their existing accent (species color doesn't apply
to money).

### Testing

`apps/web` has no test suite yet (Phase 3, per existing package.json) —
this spec doesn't introduce one. Verification is manual: play a full game
through the browser (per the `run` skill pattern already used for this
project) and confirm each event type appears in the feed, each animation
plays once at the right trigger, and every species' cards are visually
consistent everywhere they render.

## Open questions / risks

- The event feed's "last 50 events" cap is a reasonable default, not a
  hard requirement — revisit if playtesting shows it's too short/long.
- Exposing `donkeyRevealCount` on `GameStateView` is a small, additive
  server change (one field, mirrors how `phase` was added in the rules-fix
  plan) — flag this explicitly to whoever plans the implementation so it
  isn't missed as "web-only" scope creep in the wrong direction (it's a
  genuinely necessary small server addition, not scope creep).
