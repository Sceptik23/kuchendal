# Kuhhandel Rules-Engine Correctness — Design

## Background

A rules audit against the official French Kuhhandel rulebook (see
`docs/HANDOFF_KUHHANDEL_RULES_FIX.md` for the full rulebook text and the
original finding-by-finding audit) found 6 gameplay-affecting bugs and 3
lower-impact issues in `packages/game-engine` and its consumers. Several
of these are correctness bugs that can flip who wins a game (missing
scoring multiplier, wrong species values, wrong Kuhhandel money handling),
and two are entirely missing mechanics (golden donkey, special 2-card
Kuhhandel, forced end-game Kuhhandel phase).

This spec covers all of it as one consolidated piece of work, since the
findings are entangled: the end-game trigger (finding 6) depends on the
shared money bank (finding 8) existing for the donkey bonus (finding 3) to
draw from, and the species fix (finding 2) touches the scoring fix
(finding 1)'s test fixtures.

**Out of scope:** any DB migration/backfill of historical game or score
records in `supabase`. Existing games/scores computed under the old
(wrong) rules are accepted as a known gap, not corrected retroactively.

## Goals

- Every mechanic in the rulebook (scoring multiplier, species roster,
  golden donkey, special 2-card Kuhhandel, Kuhhandel money resolution,
  end-game trigger + forced Kuhhandel, starting money, shared money bank)
  matches the rulebook exactly.
- Species data has one authoritative source, consumed by both the server
  package and the browser bundle without pulling engine logic into the
  client.
- The fix is live end-to-end: `apps/realtime-server` (the actual live
  authority) and its downstream consumers (`bot-engine`,
  `rare-events-engine`, `meta-engine`, `apps/web`) are updated in the same
  pass, not left referencing stale data/logic.
- Real automated test coverage for the rules engine, since this package
  has no UI to eyeball-verify against — correctness has to be provable by
  running `vitest`.

## Non-goals

- Historical data backfill (see Out of scope above).
- Any UI/visual changes beyond the minimal artwork remap needed for the
  species roster fix (`animal-Poule` → `coq`).
- Redesigning the auction/bidding flow, which was separately audited and
  confirmed correct (droit de préemption, no-bid triple-call).

## Design

### 1. Species data — single source of truth

Today `SPECIES_KEYS`/`SPECIES_FAMILY_VALUE` are hand-duplicated in
`packages/game-engine/src/config/species.config.ts` and
`packages/shared-types/src/species.ts` (the latter exists specifically to
avoid pulling game-engine's whole barrel into the browser bundle — a real
webpack finding from the UI restyle phase).

**Fix:** introduce a new workspace package, `packages/shared-data`,
containing a plain data file (`species.ts` exporting a `const` object/array
— no imports, no logic, tree-shakeable and safe to bundle in the browser).
It holds the corrected roster and values:

| Species | Value |
|---|---|
| coq | 10 |
| oie | 40 |
| chat | 90 |
| chien | 160 |
| mouton | 250 |
| chevre | 350 |
| ane | 500 |
| cochon | 650 |
| vache | 800 |
| cheval | 1000 |

`boeuf` is removed (it doesn't exist in the real game). `coq` is added;
its card artwork reuses the existing `animal-Poule` asset (same slot/value,
naming variant from an earlier design handoff) — remapped in
`apps/web`'s asset lookup, no new art generated. Confirm whether any
`boeuf`-specific placeholder art exists and remove it if so.

Both `packages/game-engine/src/config/species.config.ts` and
`packages/shared-types/src/species.ts` import `SPECIES_KEYS` /
`SPECIES_FAMILY_VALUE` from `@kuhhandel/shared-data` instead of declaring
their own copies. `SpeciesKey` (the type) is re-exported from both for
backward-compatible import paths in existing consumers.

All known consumers get updated to the new roster/values (re-grep before
fixing, this list is from the original audit and may be incomplete):
`apps/web/lib/species.ts`, `apps/web/app/style-guide/page.tsx`,
`apps/web/components/GameTable.tsx`, `apps/realtime-server/src/room/GameRoom.ts`,
`GameStatsTracker.ts`, `packages/bot-engine/src/decisions.ts`,
`packages/rare-events-engine/src/config/rareEvents.config.ts`,
`packages/meta-engine/test/*`, `packages/game-engine/test/{setup,scoring}.test.ts`.

### 2. Scoring multiplier (finding 1)

`computeScore` (`packages/game-engine/src/scoring/scoring.ts`) changes from
summing complete-family values to: sum complete-family values, separately
count the number of complete families, multiply the sum by that count.
Incomplete families keep contributing `INCOMPLETE_FAMILY_VALUE` (0) per
family and do not count toward the multiplier.

Test cases added to `scoring.test.ts`: the rulebook's own worked example
(4 cochons + 4 chiens + 4 coqs → 650+160+10=820, ×3 → 2460, using
corrected values from section 1), zero complete families, exactly one
complete family (×1, i.e. unchanged from today's behavior), and all ten
families complete.

### 3. Shared money bank (finding 8) — foundation for findings 3, 5, 7

New module `packages/game-engine/src/money/moneyBank.ts` modeling the
finite 55-card supply: 10×0, 20×10, 10×50, 5×100, 5×200, 5×500. A
`MoneyBank` type (counts per denomination) with `drawFromBank(bank, denomination, count)`
style helpers that decrement the bank and mint the corresponding
`MoneyCard[]` (or throw/return null if the bank is empty for that
denomination — see error handling below).

`GameState` (`packages/game-engine/src/types.ts`) gains a `moneyBank:
MoneyBank` field. `createStartingMoney` (`packages/game-engine/src/setup/createStartingMoney.ts`)
is changed to draw each player's starting hand from a freshly-initialized
bank rather than minting cards independently with a global counter;
returns both the dealt hands and the resulting bank state after dealing.
Corrected starting allotment (finding 7): 2×0 + 4×10 + 1×50 = 90 per
player, replacing today's 2×100+1×200 over-allocation.

Golden donkey bonuses (section 5 below) draw from this same
post-deal bank state, threaded through `GameState.moneyBank` for the rest
of the game.

**Error handling:** if a donkey bonus needs a denomination the bank has
run out of (a real edge case only at unusual player counts/timings), fall
back to the next-higher available denomination rather than throwing —
mirrors how a physical game would handle running out of a specific
denomination without halting play, and keeps money bank finite while never
blocking a rule-required payout. Document this fallback inline; it's not
expected to trigger in normal 3-6 player games.

### 4. Kuhhandel money resolution + special 2-card trade (findings 5, 4, 9)

**Money resolution (finding 5):** `movePotToWinner` in
`packages/game-engine/src/engine/applyResults.ts` is removed. On
`counter_resolved` / `tie_default_initiator_wins`, only the animal card(s)
move to the winner; each side keeps the money they staked (no pot
consolidation, no money created or destroyed). The `KuhhandelResult`
variants keep carrying `potMoney` for narration/stats purposes (e.g. "X
bid Y money") but `applyKuhhandelResult` no longer moves it.

**Special 2-card trade (finding 4):** `KuhhandelState`
(`packages/game-engine/src/kuhhandel/kuhhandel.ts`) gains a `cardCount: 1 | 2`
field, determined automatically in `startKuhhandel` by checking whether
*both* the initiator and target hold at least 2 cards of the traded
species — no new player-facing choice, matches the rulebook's literal
"if both hold two, the trade covers both" / "if either holds only one, the
trade covers only one" wording. `removeAnimalOfSpecies` in
`applyResults.ts` becomes `removeAnimalsOfSpecies(players, fromId,
species, count)`, removing `count` cards via a loop instead of a single
`findIndex`; both the `accept` and `counter_resolved`/`tie_default_initiator_wins`
paths in `applyKuhhandelResult` pass `state.cardCount`/`result.cardCount`
through.

**Dead type cleanup (finding 9):** `KuhhandelTieBreakResolution` in
`kuhhandel.config.ts` is deleted — it was never consumed; the actual
tie-break behavior (`KUHHANDEL_TIE_BREAK_MAX_ROUNDS`) already matches the
rule and is left as-is.

**Docs:** `docs/01_GDD_GAMEPLAY.md §3.2.4` is corrected to describe
money-stays-with-staker instead of pot-to-winner (it currently documents
the wrong behavior as intentional).

### 5. Golden donkey (finding 3)

New function `checkGoldenDonkey(revealedCard, donkeyRevealCount, bank,
players)` in `packages/game-engine/src/kuhhandel/` or a new
`donkey/goldenDonkey.ts` module. `GameState` gains a `donkeyRevealCount:
number` field (0-4, since 4 donkeys exist in the 40-card deck).

Called by `apps/realtime-server/src/room/GameRoom.ts` immediately after
drawing the top deck card for auction and before `startAuction`: if the
card's species is `ane`, distributes one bonus card to every player
(including the current leader) at `[50, 100, 200, 500][donkeyRevealCount]`,
drawn from `GameState.moneyBank`, increments `donkeyRevealCount`, then
proceeds to start the auction on the donkey card normally — no special
casing inside `auction.ts`/bidding logic itself, this is purely a
pre-auction interrupt.

### 6. End-game trigger + forced-Kuhhandel phase (finding 6)

`isGameOver` (`packages/game-engine/src/scoring/scoring.ts`) is redefined
to check "all 10 families complete across all players' hands" instead of
`deck.length === 0`. `GAME_END_CONDITION` in `game.config.ts` is updated
to describe this (or removed if it becomes redundant with the
`isGameOver` implementation — decide during implementation).

`GamePhase` (`packages/game-engine/src/types.ts`) gains a new value,
`FORCED_KUHHANDEL`. `GameRoom.ts` transitions into this phase the instant
the animal deck empties (`deck.length === 0`) — from that point, starting
a new auction is rejected, and Kuhhandel becomes the only available
action on a player's turn. A player whose entire hand consists of
complete families cannot participate in a Kuhhandel (nothing to trade)
and is auto-passed instead of being offered an action. The phase
transitions to `SCORING`/`GAME_OVER` once the redefined `isGameOver` (all
families complete) becomes true.

### Testing

- `scoring.test.ts`: multiplier cases (section 2).
- `kuhhandel.test.ts`: money-stays-with-staker on counter-resolved/tie
  paths, 2-card special trade (both directions: accept and
  counter-resolved), 1-card trade still works when only one side holds 2.
- New `moneyBank.test.ts`: bank initializes to 55 cards across correct
  denominations, dealing starting hands decrements it correctly, drawing
  for a donkey bonus decrements it, fallback behavior when a denomination
  is exhausted.
- New `goldenDonkey.test.ts`: bonus amount matches
  `[50,100,200,500]` sequence across up to 4 reveals, every player
  (including leader) receives a card, donkey then auctions normally.
- `auction.test.ts`: unaffected by this spec, but re-run to confirm no
  regression from `GameState`/type changes.
- `engine.integration.test.ts`: extended to play a full game reaching the
  corrected end condition (all 10 families complete), including at least
  one donkey reveal and a stretch of forced-Kuhhandel turns after deck
  exhaustion (including a player with only complete families being
  auto-passed).
- `apps/realtime-server`: existing tests (if any) updated for the new
  phase and `GameRoom.ts` changes; if no existing test coverage there,
  note as a gap rather than introducing a new test framework mid-fix.

## Open questions / risks

- `packages/meta-engine` badges/leaderboards may reference old species
  keys (`boeuf`) or scores computed with the missing multiplier for any
  games already played by real accounts (see handoff's login-debug
  finding). Per the out-of-scope decision above, this is not backfilled,
  but `meta-engine` code should not crash on encountering old data shapes
  — verify it degrades gracefully rather than throwing.
- The bank-exhaustion fallback (section 3) is a judgment call not
  explicitly covered by the rulebook; documented as best-effort rather
  than a hard rule.
