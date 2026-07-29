# Handoff: Kuhhandel Rules-Engine Correctness Fix

> Paste this file's path (or its content) at the start of a new conversation
> to resume this work with full context. Written 2026-07-29 at the end of a
> session that (1) shipped the full UI/UX restyle (Phases 1-2, both merged
> to `main`), (2) debugged a login report, and (3) audited the game rules
> engine against the official French rulebook — this doc carries #3 forward,
> since it's real, scoped work that didn't get started yet.

## Project context

Kuchendal (`/Users/jonathanbraun/kuchendal`) is an online adaptation of the
physical French board game **Kuhhandel** — a livestock-auction/bluffing
game for 3-5 players. Monorepo, pnpm workspaces:

- `packages/game-engine` — pure game rules/state machine (auction, kuhhandel
  trading, scoring, deck setup). **This is where almost all of the fix
  below lands.**
- `packages/shared-types` — types re-exported to the frontend; currently
  has its own **duplicated copy** of species data (see Finding 1).
- `apps/realtime-server` — Socket.io server hosting `game-engine`, the
  actual live authority.
- `apps/web` — Next.js frontend (just fully restyled, see Phases 1-2 below).
- `packages/bot-engine`, `distinctions-engine`, `meta-engine`,
  `narrator-engine`, `rare-events-engine` — secondary systems that also
  reference species data.
- `supabase/migrations` — Postgres schema/seed data.

**Two design specs/plans already exist and are merged** (for context on
what the UI/UX looks like now, not directly relevant to this rules fix):
`docs/superpowers/specs/2026-07-28-art-direction-foundation-design.md` +
plan, and `docs/superpowers/specs/2026-07-28-full-screen-uiux-design.md` +
plan. Both executed via `superpowers:subagent-driven-development` in
isolated worktrees, each with a spec → plan → per-task
implement/review/fix-loop → final whole-branch review cycle. **Use the same
process for this fix** (brainstorm → spec → plan → subagent-driven-development
execution) — it worked well both times.

## What triggered this: a rules audit against the real rulebook

The user provided the actual French Kuhhandel rulebook and asked to verify
the implementation against it. A read-only code audit (Explore agent) found
significant, real discrepancies — this is not cosmetic, several of these
bugs can flip who wins a game. Full official rulebook text (French) is
preserved below so the next session doesn't need it re-supplied.

### Audit findings, ranked by gameplay impact

**1. Scoring multiplier is missing entirely — highest impact.**
Rule: total points = (sum of complete families' values) × (number of
complete families held). Worked example from the rulebook: a player with
4 cochons + 4 chiens + 4 coqs = 650+160+10 = 820, **×3** (3 complete
families) = **2460**.
Code (`packages/game-engine/src/scoring/scoring.ts:5-16`, `computeScore`)
sums complete-family values but **never multiplies by family count** — the
same player would score only 820. This silently produces wrong winners
whenever anyone completes 2+ families.

**2. Species roster and point values are wrong.**
Real game (confirmed via the rulebook's own worked example, matching the
original design handoff's mockup data that was wrongly dismissed as
placeholder noise in an earlier session): **Coq 10, Oie 40, Chat 90, Chien
160, Mouton 250, Chèvre 350, Âne 500, Cochon 650, Vache 800, Cheval 1000.**
Code (`packages/game-engine/src/config/species.config.ts:7-33`) has:
`cochon:100, oie:200, mouton:300, chevre:400, ane:500, chien:650, chat:800,
cheval:1000, boeuf:1200, vache:1500` — an invented linear 100→1500 scale,
with **Bœuf substituted for Coq** (Bœuf doesn't exist in the real game;
Coq/rooster is entirely missing from ours). The code's own comment admits
this: *"valeurs choisies arbitrairement... à ajuster en playtest"* (never
finished). **This is duplicated with no sync check** in
`packages/shared-types/src/species.ts:18-33` (added recently during the
UI phase specifically to avoid a bundle-size problem — see "constraints
to preserve" below, this duplication was intentional at the time but now
needs updating in both places, ideally with a single source of truth
restored some other way).
Consumers to update (all found via grep, not exhaustive — re-grep before
fixing): `apps/web/lib/species.ts`, `apps/web/app/style-guide/page.tsx`,
`apps/web/components/GameTable.tsx`, `apps/realtime-server/src/room/
GameRoom.ts`, `GameStatsTracker.ts`, `packages/bot-engine/src/
decisions.ts`, `packages/rare-events-engine/src/config/
rareEvents.config.ts`, `packages/meta-engine/test/*`,
`packages/game-engine/test/{setup,scoring}.test.ts`. Also: the extracted
card artwork (`apps/web/public/cards/*.webp`, from Phase 1) has real art
for `animal-Poule` (chicken) that was never mapped to a real species
because the design handoff used "Poule" where the rulebook says "Coq"
(rooster) — same slot/value (10), just a naming variant; **`animal-Poule`
artwork can likely be reused for the real `coq` species** once the roster
is fixed, avoiding needing new art. There's currently no artwork for
`boeuf` (which is being removed anyway) — check whether `Bœuf` art needs
to be discarded or was never generated (Phase 1 already used a placeholder
fallback for it, so likely never generated).

**3. L'âne d'or (Golden Donkey bonus) is not implemented at all.**
Rule: when a "âne" (donkey) card is revealed for auction, before bidding
starts, every player (including the leader) gets one bonus money card —
50 on the 1st donkey reveal that game, 100 on the 2nd, 200 on the 3rd, 500
on the 4th (4 donkeys exist in the 40-card deck, so up to 4 triggers/game).
Then the donkey auctions normally. Nothing in `packages/game-engine/src`
references "donkey"/"golden"/special-cases the âne species at all.

**4. Le marchandage spécial (2-card Kuhhandel) is not implemented.**
Rule: if both players in a Kuhhandel each hold exactly 2 cards of the same
species, the trade covers both cards at once (winner takes both).
`KuhhandelState` (`packages/game-engine/src/kuhhandel/kuhhandel.ts:7-15`)
only ever stores a single `species`, no quantity; `removeAnimalOfSpecies`
(`applyResults.ts:86-102`) always removes exactly one card via
`findIndex` regardless of how many either player holds.

**5. Kuhhandel money resolution is wrong.**
Rule: on a non-tie resolution, whoever offered less loses their animal,
but **each side keeps the money the opponent staked** — only the animal
changes hands, no extra money is created or destroyed.
Code (`applyResults.ts:71-79`, `movePotToWinner`) gives the **entire
combined pot** (both stacks) to the winner instead — the winner
illegitimately gets free money on top of the animal. This corrupts the
money economy on every non-trivial Kuhhandel. (Note: the comment at
`applyResults.ts:69` cites `GDD §3.2.4` claiming this is correct per the
GDD — the GDD itself may need correcting too, or was simply wrong; verify
against `docs/01_GDD_GAMEPLAY.md` when fixing.)

**6. End-game trigger is wrong; forced-Kuhhandel end-game phase is
missing.**
Rule: the game ends when **all 10 families are complete** — a separate,
later event from the animal deck running out. Once the deck is empty,
auctions stop but Kuhhandel becomes **mandatory** on your turn; a player
holding only complete families must pass.
Code (`game.config.ts:9`, `GAME_END_CONDITION = 'deck_exhausted'`;
`scoring.ts:18-20`, `isGameOver` checks `deck.length === 0`) ends the game
the moment the deck is empty — cutting off Kuhhandel trading of any
remaining incomplete families. No forced-Kuhhandel/must-pass logic exists
anywhere in `game-engine/src` or `realtime-server/src`.

### Lower-impact findings

**7. Starting money is inflated.** Rulebook: 2×0 + 4×10 + 1×50 (total 90).
Code (`money.config.ts:9-21`, `STARTING_MONEY`) gives 2×0 + 4×10 + 1×50 +
**2×100 + 1×200** (total 570) — 6.3x too much starting capital, comment
admits "choix arbitraire."

**8. No shared 55-card money bank is modeled.** Rulebook specifies a
finite shared money supply (10×0, 20×10, 10×50, 5×100, 5×200, 5×500 = 55
cards) that donkey bonuses and other effects draw from.
`createStartingMoney.ts` just materializes each player's allotment
independently with a global ID counter — no shared pile object exists.
This blocks correctly implementing Finding 3 (donkey bonuses need to come
from somewhere finite).

**9. Dead/unused type.** `KuhhandelTieBreakResolution` (`'initiator_wins' |
'reoffer'`, `kuhhandel.config.ts:14`) is declared but never imported or
consumed. The actual tie-break behavior is hardcoded separately in
`kuhhandel.ts:113-125` via `KUHHANDEL_TIE_BREAK_MAX_ROUNDS = 2`, and
*that* logic happens to numerically match the rule (1st tie = reoffer,
2nd tie = initiator wins) — but the "wins for free" part still needs
fixing per Finding 5 (money shouldn't move on a forced-free transfer
either). Minor: clean up the dead type when touching this area.

## Verified separately, correct — no changes needed

- **Droit de préemption** (leader buy-back after auction): correct.
  `auction.ts:99-103` — seller pays the highest bidder the winning amount,
  takes the card. Matches the rule.
- **No-bid triple-call rule**: correct. `auction.ts:78-83` — leader gets
  the card free when nobody bid, correctly distinct from the paid
  pre-emption path. Gated by `NO_BID_SELLER_KEEPS_FREE`
  (`game.config.ts:6`).

## Full official rulebook text (French), for reference without re-asking the user

```
KUHHANDEL
Un jeu de cartes pour 3 à 5 joueurs de 10 à 99 ans.

CONTENU
40 cartes « animaux » (10 familles de 4)
55 cartes « argent » (10 cartes d'une valeur de 0, 20 cartes d'une valeur
de 10, 10 cartes d'une valeur de 50, 5 cartes d'une valeur de 100, 200 et
500)

BUT DU JEU
Chaque joueur essaie d'acheter les animaux qui rapportent le plus de
points. Pour cela, il existe les enchères ou bien le marchandage
(« Kuhhandel »), qui permet de bluffer comme un vrai maquignon. Le joueur
qui possède le plus de points à la fin de la partie a gagné.

PREPARATION
Les cartes « animaux » sont soigneusement mélangées et empilées au milieu
de la table, face cachée. Les cartes « argent » sont triées par valeur :
0, 10, 50, 100, 200, 500.
Chaque joueur reçoit deux cartes d'une valeur de 0 (cartes de bluff), 4
cartes d'une valeur de 10 et une carte d'une valeur de 50 qui constituent
son avoir de départ. Le reste des cartes « argent » est disposé en une
seconde pile. Les joueurs désignent celui d'entre eux qui sera le meneur
du premier tour. Pour des raisons tactiques, il est souhaitable que
l'argent des joueurs soit toujours être tenu caché dans la main ou même
complètement soustrait à la vue des autres joueurs.

LA PARTIE COMMENCE
A chaque tour, le meneur a le choix entre deux actions : vendre aux
enchères la carte supérieure de la pile « animaux » ou bien proposer un
marchandage (« Kuhhandel ») à un adversaire.
Dès qu'un joueur a terminé l'une de ces deux actions, son voisin de
gauche devient le nouveau meneur. Au début du jeu, il n'y a que des
enchères, parce que les marchandages ne sont pas encore possibles.
Cependant, dès que deux joueurs possèdent des cartes d'une même famille,
le marchandage est également possible.

Les enchères
Le meneur retourne la carte supérieure de la pile « animaux » et ouvre
ainsi les enchères. A partir de cet instant, tous les autres joueurs ont
le droit de faire l'offre de leur choix, qui doit toujours être
supérieure à l'offre précédemment annoncée. Le meneur n'a pas le droit
de participer aux enchères. Lorsqu'il n'y a plus d'enchérisseur, le
meneur clôt les enchères en disant par exemple : « 30 une fois, 30 deux
fois, 30 trois fois, adjugé ! »
Un joueur chanceux peut obtenir un animal valant beaucoup de points au
prix dérisoire de 10, mais un autre joueur peut également payer un
animal largement au-dessus de sa valeur en points.
Lorsque les enchères sont closes, le meneur remet au plus offrant la
carte qu'il a achetée. C'est le meneur qui reçoit l'argent des
enchères ! Si le meneur n'exerce pas son « droit de préemption » sur la
carte vendue aux enchères, le tour est terminé.

Le « droit de préemption » du meneur
Le meneur a le droit d'acheter lui-même l'animal mis aux enchères. Il
doit alors annoncer à la fin des enchères au joueur le plus offrant
qu'il souhaite acheter la carte mise en vente. Dans ce cas, c'est le
meneur qui paie au plus offrant la somme que ce dernier avait oralement
proposé de payer, puis il prend la carte mise en vente.

Pas la somme exacte ? Plus assez d'argent ?
Il est interdit de faire la monnaie. Un joueur qui ne peut pas donner la
somme exacte, doit donner plus. Cela vaut également pour le meneur
lorsqu'il exerce son « droit de préemption ».
Le joueur qui constate qu'il ne peut pas payer la somme qu'il a proposée
aux enchères doit montrer tout son argent aux autres joueurs. Les
enchères sont alors recommencées.
Si aucun enchérisseur ne se déclare, le meneur doit proposer 3 fois la
carte aux autres joueurs en disant par exemple : « Une oie, une fois,
une oie deux fois, une oie trois fois ! » Si pendant ce temps, aucune
offre n'a été faite, le meneur obtient la carte proposée sans rien
débourser.
Si en revanche un joueur fait une offre, aussi petite soit-elle, le
meneur lui remet alors la carte et reçoit l'argent, à moins qu'il n'ait
fait usage de son « droit de préemption ». Par principe, les joueurs
placent toutes leurs cartes «animaux » face visible devant eux et bien
étalées sur la table.

L'âne d'or apporte de l'argent frais dans la partie
Si un joueur retourne une carte « âne », les enchères sont
momentanément interrompues : le meneur distribue à chacun (et à lui
aussi) une carte « argent » supplémentaire. La première fois qu'un âne
est retourné, chaque joueur reçoit 50, la deuxième fois 100, la
troisième fois 200 et la quatrième fois 500. Lorsque l'argent est
distribué, l'âne est mis aux enchères comme n'importe quel autre animal.

Le marchandage (« Kuhhandel »)
Lorsque deux joueurs possèdent des animaux d'une même famille, l'un des
deux joueurs, une fois qu'il est meneur, peut proposer à l'autre un
marchandage. Le marchandage débute ainsi : le joueur A fait une
proposition secrète au joueur B en posant la somme d'argent de son
choix, face cachée, sur la table et en indiquant à l'autre joueur quel
animal il souhaite acheter. Pendant le marchandage, le bluff est permis.
Il est par exemple permis de poser la main vide sur la table, sans
argent. Il est également permis de mettre dans son offre toutes ses
cartes de bluff ou bien rien que des cartes de bluff.
Plus le joueur A bluffera intelligemment, moins le joueur B saura
déduire le montant de l'offre qui lui est faite à partir du nombre des
cartes posées.
Lorsque l'offre du joueur A est posée sur la table, le joueur B peut
réagir de deux manières différentes :
Première possibilité : Le joueur B fait une contre-proposition secrète
qu'il pose sur la table. Dans ce cas, les deux sommes d'argent sont
échangées et on procède en secret au décompte des cartes échangées. Le
joueur qui reçoit de la part de son adversaire plus d'argent que ce
qu'il avait lui-même proposé doit céder son animal. Mais chaque joueur
conserve l'argent proposé par son adversaire. Le marchandage est alors
terminé. Si, par hasard, l'offre et la contre-proposition sont d'un même
montant, le joueur qui a proposé le marchandage doit faire une nouvelle
offre pour le même animal. Il a bien sûr le droit de faire une offre
différente de la première. Le joueur B doit de nouveau se décider. S'il
refait une contre-proposition et que les deux offres sont par hasard à
nouveau de même montant, le joueur B doit céder gratuitement son animal
au joueur A.
Seconde possibilité : Le joueur B accepte l'offre sans faire de
contre-proposition et donne au joueur qui a proposé le marchandage
l'animal demandé. C'est une autre manière de mettre fin au marchandage.

Le marchandage spécial
Si les joueurs A et B possèdent chacun deux cartes de la même famille,
le marchandage portera sur les deux cartes en même temps. L'un des deux
joueurs gagnera les deux cartes de l'adversaire et complétera ainsi sa
famille.
Si l'un des deux joueurs ne possède qu'une seule carte de la même
famille, le marchandage ne porte que sur un seul animal.

Cartes « animaux » épuisées
Lorsqu'il n'y a plus de cartes « animaux » à vendre aux enchères, les
marchandages deviennent obligatoires. Les joueurs qui, à ce moment du
jeu, ne possèdent que des familles complètes, ne peuvent plus participer
aux marchandages et doit passer son tour.

FIN DE LA PARTIE
Lorsque toutes les familles sont complètes, le jeu est terminé. Chaque
joueur calcule alors le total de ses points : le nombre inscrit sur
chaque carte indique la valeur en points de la famille au complet (par
exemple 4 vaches = 800 points). L'argent n'a plus aucune valeur.
Si un joueur possède deux familles, il double ses points, s'il en a 3,
il multiplie ses points par trois, etc.
Un exemple : Un joueur possède 4 cochons, 4 chiens et 4 coqs. Son total
est de : 650 + 160 + 10 = 820 points. Comme il possède 3 familles, il
multiplie le nombre précédent par 3 et obtient ainsi 2460 points.
```

## Constraints/context to carry into the new session

- **This is game-logic correctness work, not UI work.** Unlike the two
  prior UI phases, this genuinely warrants **adding real unit tests** to
  `packages/game-engine/test/` (it already has a `test/` dir with
  `setup.test.ts`/`scoring.test.ts` — check what test runner is already
  configured before picking a new one) — the two prior phases deliberately
  skipped tests because there was no runner and it was pure presentation;
  this is server-authoritative game rules where correctness is the whole
  point, so a "no test framework" constraint should NOT be inherited
  blindly this time. Raise this explicitly during brainstorming.
- **Species data duplication**: during Phase 2, `SPECIES_FAMILY_VALUE`/
  `SpeciesKey` got duplicated from `packages/game-engine` into
  `packages/shared-types/src/species.ts` specifically to avoid pulling the
  whole rules engine into the browser bundle (a real webpack/bundle-size
  finding from that phase's final review). When fixing the species
  roster, **both copies need updating together**, and it may be worth
  reconsidering whether a build-time codegen step or a shared JSON file
  (imported by both, bundled safely since it's just data) is cleaner than
  two hand-synced TS files — worth a brainstorming question.
  `packages/shared-types/src/species.ts` even carries a comment
  acknowledging the manual-sync risk.
- **Live game data**: check whether any real games have been played/scored
  with the current wrong species values (the login-debug session confirmed
  at least one real user account — `jonathanbraun20@gmail.com`, username
  `Sceptik` — exists and has signed in) before deciding whether a DB
  migration/backfill is needed for `packages/meta-engine`
  badges/achievements/leaderboards that may reference old species keys or
  scores computed with the broken multiplier.
- **Environment limitation from Phase 2** (may not apply here): no
  authenticated browser session was reachable during agentic work
  (account creation/credential entry are both off-limits). This
  shouldn't block THIS fix much since `game-engine` is unit-testable
  server-side logic, not UI — but if verification requires a live
  multiplayer game walkthrough, the same limitation applies.
- **Process to follow**: `superpowers:brainstorming` →
  `superpowers:writing-plans` → `superpowers:subagent-driven-development`
  in an isolated worktree (`EnterWorktree`), same pattern as both prior
  phases in this repo. Specs live in `docs/superpowers/specs/`, plans in
  `docs/superpowers/plans/`.
- **Everything from Phases 1-2 is merged to `main` and pushed to
  `origin/main`** as of this handoff — no pending branches, clean
  starting point.

## Suggested first question for the new session's brainstorm

Given the size (6 real bugs across scoring, species data, two missing
mechanics, and an end-game state-machine change), the new session should
open by proposing how to decompose this — e.g., one spec/plan per bug vs.
one consolidated "rules engine correctness" spec/plan covering all of it
(the latter is probably right, since several bugs are entangled: fixing
end-game trigger (#6) requires the shared money bank (#8) to exist for the
donkey bonus (#3) to make sense, and the species fix (#2) touches the
scoring fix (#1)'s test fixtures) — but confirm with the user rather than
assuming.
