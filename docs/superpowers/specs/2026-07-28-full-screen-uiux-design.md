# Kuchendal — Phase 2: Full Screen UI/UX

## Context

Phase 1 (merged) built the design-token system and 8 reusable primitives in
`packages/ui`. No actual screen consumes them yet — every component in
`apps/web/components/` is still plain unstyled HTML. This phase restyles
every screen end-to-end using the Phase 1 primitives and the full design
handoff (`~/Downloads/design_handoff_kuchendal/`), so the live app matches
the intended visual direction from login through gameplay to end-of-game.

Per explicit instruction: proceed through all screens without per-step
approval. Where the design assumes a capability the backend doesn't have,
adapt gracefully (style what's real, omit or clearly placeholder what
isn't) rather than fabricating fake functionality, and compile a punch list
of gaps at the end instead of stopping to ask.

## Architecture decision: no new routing

The current app (`apps/web/app/page.tsx`) is a single-page state machine:
it conditionally renders `AuthForm` → `JoinForm` (Hub) → `Lobby` →
`GameTable` based on auth/game state, with `JoinForm` further toggling
inline panels (`Profile`, `Leaderboards`, `MatchHistory`, `Friends`). There
is no `next/navigation` usage anywhere in the codebase.

Decision: **keep this pattern**, don't introduce Next.js routes for
Profil/Classements/Paramètres. Instead, the Hub gets a small persistent
top nav (logo + Profil/Classements/Paramètres/Déconnexion) that drives the
same kind of local view-state JoinForm already uses for its toggles. This
avoids duplicating auth guards across real routes and matches the existing
convention. These screens aren't deep-linked in the design either.

## Screen-by-screen mapping and adaptations

For each design file, what gets built and how it adapts to real data:

**Accueil (`Kuchendal Accueil.dc.html`) → `AuthForm.tsx`**
Bungee gradient hero, swirl background, tab toggle (Connexion/Inscription),
styled fields. The design's "Jouer en invité" button is dropped — no guest
auth path exists anywhere in `authStore`/backend. Existing `signIn`/`signUp`
logic is untouched, only presentation changes.

**Hub (`Kuchendal Hub.dc.html`) → `JoinForm.tsx` (split/restyled)**
Top nav (new) + profile summary card (level/xp — no win count exists, see
Profil below) + friends-online list (`Friends.tsx`, using
`PlayerAvatarBadge`) + créer/rejoindre CTAs. The inline
show/hide-Profile/Leaderboards/MatchHistory toggle buttons are replaced by
the top nav's Profil/Classements links; match history moves into the Profil
screen (matches the design's Profil screen, which includes recent match
history).

**Lobby (`Kuchendal Lobby.dc.html`) → `Lobby.tsx`**
Room code chip with copy-to-clipboard, 6-slot player grid with the
ready-glow treatment, host bot-adding controls (`host:addBot`, real), start
button. **Dropped**: the narrator-style picker and rounds slider — neither
is backed (no `host:setNarratorStyle` event, no `GameStateView.narratorStyle`
field, no round-count concept anywhere in `game-engine`; narrator style is
fixed at room creation and not exposed post-creation). The ready-glow
applies to every filled slot unconditionally — there's no per-player
"ready" flag in `PlayerView`, so presence in the lobby is treated as ready.

**Table de jeu desktop + mobile (`Kuchendal Table de Jeu*.dc.html`) →
`GameTable.tsx`**
One responsive component, not two — same game logic/data for both, only
layout differs (CSS breakpoint, not a duplicated file). Opponents row with
turn-glow ring (`activePlayerId === p.id`), center auction card
(`PlayingCard`), bid ticker, self-rail with hand as `PlayingCard` money
cards + stepper, `ToastNarrator` for the latest `narratorFeed` entry,
spotlight-styled `RareEventBanner`. The existing ✅/🔒 money-visibility
markers become `InfoStatusIcon` (`known`/`partial`) — this finally closes
out the `docs/DESIGN_ASSETS.md` §3 item for status icons.

**Résolution d'enchère (`Kuchendal Résolution Enchère.dc.html`) →
`AuctionPanel.tsx`**
Styled in place (bid buttons, seller-decision buttons), not a separate
overlay — `AuctionState` has no bid-history array (only `highestBid`), so
the design's full bid-history list isn't renderable; show the current
highest bid + bidder instead.

**Résolution de Kuhhandel (`Kuchendal Résolution Kuhhandel.dc.html`) →
`KuhhandelPanel.tsx`**
Styled in place (face-down/known money trays via `PlayingCard` money
variant). **Dropped**: the countdown ring and simultaneous-reveal animation
— resolution is immediate on accept/counter, there's no timed-reveal phase
in `KuhhandelPublicView`.

**Fin de partie (`Kuchendal Fin de Partie.dc.html`) → the `status ===
"finished"` branch of `GameTable.tsx`**
Winner banner, CSS confetti, final ranking, Hall of Shame/Fame (existing
`HallOfFameShame`, already has real data). **Adapted**: single "Retour au
hub" button that clears local game-store state (`roomCode`/`playerId`/
`state`) — there's no `rematch`/`lobby:reset` event, so "Rejouer" as a
separate action is dropped in favor of the one working path back to a place
where a new game can be created.

**Profil public (`Kuchendal Profil Public.dc.html`) → `Profile.tsx`**
Avatar (initial-letter fallback via `PlayerAvatarBadge`) + active title
pill, badges grid (`RarityFrame`, mapping DB's `ultra_secret` → the
component's `ultra-secret` rarity key), achievements, match history
(absorbing `MatchHistory.tsx`). **Adapted stat tiles**: the design's 4
tiles (Parties jouées/Victoires/Argent max/Niveau) aren't fully backed —
`ProfileData` only has `xp`, `level`, badge/achievement/title counts. Show
4 tiles built from what's real: Niveau, XP, Badges débloqués, Titres
débloqués.

**Classements (`Kuchendal Classements.dc.html`) → `Leaderboards.tsx`**
2 tabs, not 3 — `LeaderboardScope` is `'global' | 'friends'` only, no
`'weekly'` scope exists. Rank-colored numerals for top 3, same styling
otherwise.

**Paramètres (`Kuchendal Paramètres.dc.html`) → new `Settings.tsx`**
No existing component for this screen. Built from scratch, reachable from
the Hub top nav:
- Pseudo field: **read-only display**, no `update-username` mutation exists.
- "Changer l'avatar": **disabled/placeholder**, no avatar system exists.
- Narrator style default: **real**, backed by `localStorage`
  (`kuchendal:defaultNarratorStyle`), pre-fills the Hub's create-game
  narrator select.
- Sound toggle: **real**, backed by `localStorage`
  (`kuchendal:soundEnabled`), gates `lib/sound.ts`'s `playSound`.
- Music / Notifications toggles: rendered per the design but **inert** —
  no background-music system or notification system exists yet.
- Se déconnecter: real (`authStore.signOut`).
- Supprimer le compte: **disabled/placeholder**, no delete-account mutation
  exists.

## Out of scope for this phase

Badge icons beyond the rarity-colored frame (the design's own reference
file uses colored frames only, no icons — nothing missing here). Narrator
icons (same — colored square + label per the reference file, already
covered by `ToastNarrator`). Sound files, background music, rare-event VFX
beyond CSS (genuinely missing binary assets — `lib/sound.ts` already
no-ops gracefully when a file is absent). The 16 predefined avatar images,
profile-frame art beyond reusing `RarityFrame`, emotes (no send-emote
socket event exists), the level-40+ foil card skin (no player-level data
is plumbed into `GameStateView` client-side to gate it). Real logo
image/favicon art beyond a simple generated monogram favicon (the wordmark
itself is a styled text gradient throughout every mockup, not an image).

## Verification

`pnpm --filter @kuhhandel/web dev`, visually walk every screen and state
transition (unauth → auth → hub → lobby → in-game auction → in-game
kuhhandel → finished → profil/classements/paramètres) in a real browser.
`pnpm typecheck`/`lint`/`build` across the workspace.
