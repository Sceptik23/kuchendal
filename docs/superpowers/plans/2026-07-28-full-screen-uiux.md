# Full Screen UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every screen of the live app (Accueil, Hub, Lobby, Table
de jeu, résolutions, Fin de partie, Profil, Classements, Paramètres) using
the Phase 1 design tokens and primitives (`@kuhhandel/ui`), preserving all
existing socket/store behavior exactly, and adapting gracefully anywhere
the design assumes a backend capability that doesn't exist.

**Architecture:** No new routing — the Hub gains a small persistent
top-nav component (`apps/web/components/TopNav.tsx`) driving local
view-state, same pattern the app already uses for auth/game state
switching in `apps/web/app/page.tsx`. Every screen component keeps its
existing props/store wiring; only JSX structure and styling change, using
CSS Modules co-located with each component (matching the `packages/ui`
convention) plus the primitives from `@kuhhandel/ui`.

**Tech Stack:** Next.js 15 App Router / React 19, CSS Modules + the
`packages/ui` design tokens (`@kuhhandel/ui/src/tokens.css`, already
globally imported), the 8 Phase 1 primitives (`Button`, `PlayingCard`,
`RarityFrame`, `PlayerAvatarBadge`, `ToastNarrator`, `Input`, `Select`,
`InfoStatusIcon`).

## Global Constraints

- **Never change socket event names, payloads, or store method
  signatures.** Every `getSocket().emit(...)` call, every store selector,
  every existing prop/behavior must survive restyling unchanged. This is a
  visual/structural pass, not a feature or data-flow change.
- **Never fabricate functionality the backend doesn't support.** Where the
  design shows a control with no backing (narrator style live-edit, rounds
  slider, avatar upload, username edit, delete account, rematch, "weekly"
  leaderboard scope), either omit it or render it visibly inert — never
  wire a UI control to nothing and let it silently do nothing without
  indication, and never invent a client-only illusion of a working feature
  where the user would reasonably expect persistence.
- **Reuse `@kuhhandel/ui` primitives wherever the design calls for one.**
  Don't hand-roll a second avatar circle, card frame, or button style
  inline — that's what Phase 1 built. New CSS is only for layout
  (grids/flex) and things no primitive covers (page backgrounds, the swirl
  gradient, confetti, etc.).
- **Colors, radii, glows**: always via the existing CSS custom properties
  (`--kd-*` from `packages/ui/src/tokens.css`) — never hardcode a raw
  `oklch(...)` value in a screen component. If a design value isn't
  already a token (e.g. the swirl gradient's blur radius), that's fine as
  a literal CSS value, but *colors* always route through `--kd-*`.
- **No new test framework** — verification per task is `pnpm
  --filter @kuhhandel/web typecheck`, `lint`, and a manual browser check
  via the dev server (no unit tests exist for these components today and
  none are introduced here).
- **French copy stays French**, matching the existing app and the design
  handoff's tone.
- **Badge rarity mapping**: the DB/config rarity value `ultra_secret`
  (underscore) must be mapped to `RarityFrame`'s `'ultra-secret'` (hyphen)
  literal wherever badge data feeds a `RarityFrame` — every other rarity
  string matches `Rarity` verbatim (`commun`, `rare`, `epique`,
  `legendaire`, `mythique`, `secret`).

---

### Task 1: `TopNav` component + favicon

**Files:**
- Create: `apps/web/components/TopNav.tsx`
- Create: `apps/web/components/TopNav.module.css`
- Create: `apps/web/app/icon.svg`

**Interfaces:**
- Consumes: `useAuthStore` (`profile`, `signOut`) from
  `apps/web/store/authStore.ts`.
- Produces:
  ```ts
  export type HubView = 'home' | 'profil' | 'classements' | 'parametres';
  export interface TopNavProps {
    active: HubView;
    onNavigate: (view: HubView) => void;
  }
  export function TopNav(props: TopNavProps): JSX.Element;
  ```
  Task 3 (Hub) owns the `HubView` state and renders this at the top of
  every Hub-family screen.

- [ ] **Step 1: Write the favicon**

Create `apps/web/app/icon.svg` (Next.js App Router serves `app/icon.svg`
automatically as the site favicon/tab icon — no `<link>` tag needed):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="oklch(78% 0.27 140)"/>
  <text x="32" y="44" font-family="Arial, sans-serif" font-weight="900"
        font-size="34" text-anchor="middle" fill="oklch(14% 0.02 300)">K</text>
</svg>
```

(A plain sans-serif bold "K" is used instead of Bungee — SVG favicons
don't reliably load web fonts across browsers/tab contexts; the shape and
colors still match the direction artistique reference exactly.)

- [ ] **Step 2: Write `TopNav`**

Create `apps/web/components/TopNav.tsx`:

```tsx
"use client";

import { useAuthStore } from "../store/authStore";
import styles from "./TopNav.module.css";

export type HubView = "home" | "profil" | "classements" | "parametres";

export interface TopNavProps {
  active: HubView;
  onNavigate: (view: HubView) => void;
}

const LINKS: { id: HubView; label: string }[] = [
  { id: "home", label: "Accueil" },
  { id: "profil", label: "Profil" },
  { id: "classements", label: "Classements" },
  { id: "parametres", label: "Paramètres" },
];

export function TopNav({ active, onNavigate }: TopNavProps) {
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>KUCHENDAL</div>
      <div className={styles.links}>
        {LINKS.map((link) => (
          <button
            key={link.id}
            type="button"
            onClick={() => onNavigate(link.id)}
            className={[styles.link, active === link.id ? styles.active : ""]
              .filter(Boolean)
              .join(" ")}
          >
            {link.label}
          </button>
        ))}
        <button type="button" onClick={() => void signOut()} className={styles.link}>
          Se déconnecter
        </button>
      </div>
    </nav>
  );
}
```

Create `apps/web/components/TopNav.module.css`. Match the Hub design's top
bar treatment (gradient wordmark, small pill-style nav buttons):

```css
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 0;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--kd-border);
}

.logo {
  font-family: var(--kd-font-display);
  font-size: 22px;
  background: linear-gradient(90deg, var(--kd-accent-green), var(--kd-accent-pink));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.links {
  display: flex;
  gap: 6px;
}

.link {
  font-family: var(--kd-font-body);
  font-weight: 700;
  font-size: 13px;
  color: var(--kd-text-muted);
  background: transparent;
  border: none;
  border-radius: var(--kd-radius-sm);
  padding: 8px 14px;
  cursor: pointer;
}

.active {
  color: var(--kd-text);
  background: var(--kd-surface);
}
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: both pass. `TopNav` isn't imported anywhere yet, so no visual
check is possible until Task 3 wires it in — that's expected for this
task.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/TopNav.tsx apps/web/components/TopNav.module.css apps/web/app/icon.svg
git commit -m "feat(web): add TopNav component and app favicon"
```

---

### Task 2: Accueil screen (`AuthForm.tsx`)

**Files:**
- Modify: `apps/web/components/AuthForm.tsx`
- Create: `apps/web/components/AuthForm.module.css`

**Interfaces:**
- Consumes: `Button`, `Input` from `@kuhhandel/ui`; existing
  `useAuthStore` selectors (`signIn`, `signUp`, `error`,
  `pendingConfirmation`) — unchanged.
- Produces: no new exports; this is a leaf screen component.

- [ ] **Step 1: Read the design reference**

Read `~/Downloads/design_handoff_kuchendal/Kuchendal Accueil.dc.html` for
the exact layout: full-height centered card, animated swirl-gradient
background behind it, Bungee gradient-text "KUCHENDAL" wordmark, tagline,
a card containing a Connexion/Inscription tab toggle, Email + Mot de passe
fields, and a full-width primary CTA button whose label changes with mode
("Se connecter" / "Créer mon compte"). **Do not include a "Jouer en
invité" button** — no guest-auth path exists in `authStore` (per this
plan's Global Constraints).

- [ ] **Step 2: Restyle the component**

Modify `apps/web/components/AuthForm.tsx`: keep every existing piece of
logic (the `mode` state, the `onSubmit` handler calling `signIn`/`signUp`,
the `pendingConfirmation` early return, the `error` display, all
`required`/`minLength` attributes) — only change the JSX structure and
add `className`s from a new CSS Module, and swap the raw `<input>`/
`<button>` elements for `@kuhhandel/ui`'s `Input`/`Button` where they are
plain form fields or actions (the tab-toggle buttons are a custom
segmented-control look from the design, not a generic `Button` — keep
those as local styled `<button>`s driven by the CSS Module, matching the
design's tab pill treatment: active tab = filled pink background + dark
text, inactive = transparent).

Structure: an outer full-viewport flex-centered wrapper with the animated
swirl-gradient background (`position:absolute` full-bleed div with
`conic-gradient(...)`, `filter: blur(100px)`, a CSS `@keyframes` rotation
— reuse the exact gradient stop colors from the design, which are the 5
`--kd-accent-*` tokens in the same order: green, pink, cyan, yellow,
orange), a centered `max-width: 400px` column with the Bungee gradient
wordmark (`background: linear-gradient(90deg, var(--kd-accent-green),
var(--kd-accent-pink), var(--kd-accent-cyan)); -webkit-background-clip:
text; ...`), the tagline in `--kd-text-muted`, then the card
(`--kd-surface` background, `--kd-border` border, `--kd-radius-lg`) with
the tab toggle, labeled fields (label text: `--kd-text-muted`, 12px,
700 weight), and the submit `Button` (`variant="primary"`, full width via
a wrapper or inline style — `Button` doesn't have a `fullWidth` prop, so
wrap it in a `div` with `width: 100%` and set the button's own width via
the CSS Module class passed through `className`).

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kuhhandel/web dev`, sign out (or use an incognito/no
session state) to view `/` in the unauthenticated state. Confirm: dark
background with a subtle rotating rainbow blur behind the card, gradient
Bungee wordmark, tab toggle switches Connexion/Inscription (and the
signup-only Pseudo field appears/disappears exactly as before), submitting
still calls the real `signIn`/`signUp`. Stop the dev server after.

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/AuthForm.tsx apps/web/components/AuthForm.module.css
git commit -m "feat(web): restyle Accueil/Auth screen"
```

---

### Task 3: Hub screen — rename `JoinForm.tsx` → `Hub.tsx`, wire `TopNav`, profile summary card

**Files:**
- Rename: `apps/web/components/JoinForm.tsx` → `apps/web/components/Hub.tsx`
- Create: `apps/web/components/Hub.module.css`
- Modify: `apps/web/app/page.tsx` (update the import/usage)

**Interfaces:**
- Consumes: `TopNav`, `HubView` from `./TopNav` (Task 1); `Button`,
  `Input`, `Select`, `PlayerAvatarBadge` from `@kuhhandel/ui`; existing
  `useGameStore`/`useAuthStore` selectors — unchanged; `Profile`,
  `Leaderboards` components (Tasks 10-11 restyle their internals, this
  task only changes *how* they're shown — swap the boolean toggle buttons
  for `TopNav`-driven view state).
- Produces: `export function Hub()`. `page.tsx` imports `{ Hub }` instead
  of `{ JoinForm }` and renders it in the same branch
  (`if (!playerId || !state) return <Hub />;`).

- [ ] **Step 1: Rename the file and update the import**

```bash
git mv apps/web/components/JoinForm.tsx apps/web/components/Hub.tsx
```

In `apps/web/app/page.tsx`, change:
```tsx
import { JoinForm } from "../components/JoinForm";
```
to
```tsx
import { Hub } from "../components/Hub";
```
and change `<JoinForm />` to `<Hub />`.

- [ ] **Step 2: Add view-state driven by `TopNav`**

In `apps/web/components/Hub.tsx`, rename the exported function
`JoinForm` → `Hub`. Replace the four boolean toggles (`showHistory`,
`showFriends`, `showProfile`, `showLeaderboards`) and their four toggle
buttons with a single `const [view, setView] = useState<HubView>("home")`
and render `<TopNav active={view} onNavigate={setView} />` at the top.
Below the nav, conditionally render:
- `view === "home"`: the existing create/join sections, **plus** a new
  profile-summary card (Step 3) and the `Friends` panel (already always
  visible in the old code via `showFriends` toggle — the design's Hub
  shows the friends list unconditionally on the home view, so render
  `<Friends userId={profile.id} />` directly, no toggle).
- `view === "profil"`: `<Profile userId={profile.id} />`.
- `view === "classements"`: `<Leaderboards userId={profile.id} />`.
- `view === "parametres"`: `<Settings />` (Task 12 creates this — until
  that task lands, this branch will fail to compile; if you're
  implementing this task before Task 12 exists, stub it as `<p>Bientôt
  disponible.</p>` and leave a comment `// TODO(Task 12): replace with
  <Settings />` so Task 12 can find and replace it).
- `MatchHistory` is no longer rendered from the Hub at all — Task 10 moves
  it into the Profil screen. Remove the `MatchHistory` import/usage from
  this file entirely (delete the now-unused `showHistory` state along
  with the others).

- [ ] **Step 3: Profile summary card**

Read `~/Downloads/design_handoff_kuchendal/Kuchendal Hub.dc.html` for the
exact layout: a `320px`-wide card (avatar circle, name, active-title pill,
a 3-stat row divided by a top border). Build it using
`PlayerAvatarBadge` (`size={88}`, no `imageSrc` so it falls back to the
initial-letter circle, `status="online"` since this is always the logged-in
user viewing their own Hub) for the avatar, and real data:
`profile.username` for the name, `ProfileData.level` for one stat tile
("Niveau"), and — since win-count/badge-count aren't cheaply available
here without an extra fetch — use `ProfileData.xp` for the second tile
("XP") and `ProfileData.badges.length` for the third ("Badges"). Load
`ProfileData` the same way `Profile.tsx` does: `import { loadProfile }
from "../lib/profile";` and a `useEffect` on `profile.id`. Active-title
pill: look up the title matching `currentTitleId` in the loaded titles
array and show its `name`, or omit the pill entirely if
`currentTitleId` is `null`.

Create `apps/web/components/Hub.module.css` for the grid layout
(`320px 1fr` two-column grid per the design, collapsing to a single
column below a reasonable mobile breakpoint e.g. `768px`), the
profile-card surface (`--kd-surface`, `--kd-border`, `--kd-radius-lg`),
and the stat-row divider (`--kd-border` top border).

- [ ] **Step 4: Verify**

Run: `pnpm --filter @kuhhandel/web dev`, sign in, confirm the Hub renders
with the top nav, profile card (real level/xp/badge-count for your test
account — 0s are fine if the account has no progression yet), friends
list, and create/join sections all still functional exactly as before
(creating a room, joining a room, listing public rooms). Click each nav
link and confirm the view switches (Paramètres may show the temporary stub
if Task 12 hasn't landed yet — that's fine for this task). Stop the dev
server after.

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: both pass (aside from the expected Task-12-dependency note in
Step 2 if applicable — if implementing tasks in plan order, Task 12 won't
exist yet, so the stub keeps this compiling standalone).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/Hub.tsx apps/web/components/Hub.module.css apps/web/app/page.tsx
git commit -m "feat(web): restyle Hub screen (renamed from JoinForm), add TopNav + profile card"
```

---

### Task 4: `Friends.tsx` restyle

**Files:**
- Modify: `apps/web/components/Friends.tsx`
- Create: `apps/web/components/Friends.module.css`

**Interfaces:**
- Consumes: `PlayerAvatarBadge`, `Button`, `Input` from `@kuhhandel/ui`;
  existing `lib/friends` functions and `usePresenceStore` — unchanged.
- Produces: no new exports.

- [ ] **Step 1: Restyle**

Keep every existing function call (`listFriendships`, `sendFriendRequest`,
`respondToFriendRequest`, `removeFriendship`, `searchUsersByUsername`,
`refresh`, `search`) and the three derived arrays (`accepted`, `incoming`,
`outgoing`) exactly as-is. Restyle the JSX per the Hub design's "Amis en
ligne" panel: a `--kd-surface` card with a section label, then a list
where each row uses `PlayerAvatarBadge` (`size={44}`, `status={
onlineUserIds.has(e.friend.id) ? "online" : "offline"}`, replacing the old
🟢/⚪ emoji markers — this is another small win against the emoji-marker
pattern Phase 1's `InfoStatusIcon` was built to replace, though
`PlayerAvatarBadge`'s own status dot is the right primitive here, not
`InfoStatusIcon`, since it's presence not information-certainty) for
online/offline visualization, name, and an "Inviter"/accept/refuse action
using `Button` (`variant="secondary"` for accept/invite,
`variant="danger"` for refuse/remove). Keep the search input as
`@kuhhandel/ui`'s `Input`. Keep the three sections (search results,
incoming requests, outgoing requests, accepted friends) in the same order
with the same conditional rendering (`incoming.length > 0`, etc.) as today.

- [ ] **Step 2: Verify**

Run: `pnpm --filter @kuhhandel/web dev`, from the Hub, confirm the friends
panel renders styled, search still filters, and (if you have a second test
account available) sending/accepting a request still works. If a second
account isn't available for a live round-trip check, at minimum confirm no
console errors and that the empty states ("Aucun ami pour l'instant.")
render correctly. Stop the dev server after.

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/Friends.tsx apps/web/components/Friends.module.css
git commit -m "feat(web): restyle Friends panel"
```

---

### Task 5: Lobby screen (`Lobby.tsx`)

**Files:**
- Modify: `apps/web/components/Lobby.tsx`
- Create: `apps/web/components/Lobby.module.css`

**Interfaces:**
- Consumes: `PlayerAvatarBadge`, `Button` from `@kuhhandel/ui`; existing
  `useGameStore`/`useAuthStore` selectors, `getSocket()` emits
  (`host:kick`, `host:transfer`, `host:addBot`, `lobby:start`) — unchanged.
- Produces: no new exports.

- [ ] **Step 1: Read the design reference and note the adaptation**

Read `~/Downloads/design_handoff_kuchendal/Kuchendal Lobby.dc.html`. Per
this plan's spec, **omit** the narrator-style picker and rounds slider —
neither is backed by a live-updatable event or state field. Build only:
room code chip with copy button, the 6-slot player grid with ready-glow,
host controls, start button.

- [ ] **Step 2: Restyle**

Keep every existing behavior: the `canStart` check (`state.players.length
>= 3`), `isHost` check, the invite-URL construction and `InviteQrCode`
usage, kick/transfer buttons (host-only, not-self), the two `host:addBot`
buttons, and the `lobby:start` start button with its disabled state. Add:

- Room code chip: a pill (`--kd-surface`, 2px `--kd-accent-cyan` border)
  showing the code in Bungee font, with a "Copier"/"Copié !" button using
  the browser `navigator.clipboard.writeText(inviteUrl)` API (new local
  state for the button label, flipping back after 1.5s via `setTimeout` —
  matches the design's copy-feedback pattern from the Direction
  Artistique reference).
- Player grid: 6 slots (`grid-template-columns: repeat(3, 1fr)` desktop,
  collapsing responsively), each filled slot rendering
  `PlayerAvatarBadge` (`size={56}`) + name + a small star marker for the
  host + "Prêt" label, with the ready-glow CSS animation
  (`box-shadow` pulsing `--kd-accent-green`, via a local `@keyframes`) on
  every filled slot's card wrapper unconditionally (see Global
  Constraints note on the missing ready-flag). Empty slots (index beyond
  `state.players.length`) render a dashed-border placeholder with "en
  attente…", at 40% opacity, matching the design.
- Host controls (`host:addBot` buttons, kick/transfer) and the start
  button use `Button` (`variant="secondary"` for bot/kick/transfer,
  `variant="primary"` for start).

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kuhhandel/web dev`, create a room, confirm: room code
displays and copies correctly, your own slot renders with the glow, empty
slots show the placeholder treatment, adding a bot (as host) fills a slot
and it renders correctly too, the start button enables once 3+ players are
present. Stop the dev server after.

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/Lobby.tsx apps/web/components/Lobby.module.css
git commit -m "feat(web): restyle Lobby screen"
```

---

### Task 6: Table de jeu — top bar, player roster, turn actions (`GameTable.tsx`, part 1)

**Files:**
- Modify: `apps/web/components/GameTable.tsx`
- Create: `apps/web/components/GameTable.module.css`

**Interfaces:**
- Consumes: `PlayerAvatarBadge`, `InfoStatusIcon`, `ToastNarrator` from
  `@kuhhandel/ui`; existing `useGameStore` selectors — unchanged.
- Produces: the `GameTable.module.css` file and initial JSX restructure
  this task starts are extended by Tasks 7-9 (self-rail, résolution
  panels, finished-state) — all four tasks touch the same two files
  sequentially, in plan order, each committing its own slice. This task
  specifically covers: everything **except** the self-rail bid controls
  (Task 7), `AuctionPanel`/`KuhhandelPanel` internals (Task 8), and the
  finished-state branch (Task 9).

- [ ] **Step 1: Read the design reference**

Read `~/Downloads/design_handoff_kuchendal/Kuchendal Table de Jeu.dc.html`
and `Kuchendal Table de Jeu Mobile.dc.html`. Build one responsive
component (not two files) — desktop layout is the default; add a
`max-width` media query in the CSS Module that switches the opponents row
to horizontal-scroll and stacks things vertically per the mobile design
(vertical `100vh` shell, scrollable middle, fixed bottom self-rail —
that fixed-bottom-rail behavior is desktop-appropriate too, just less
essential there, so it's fine to share the same flex-column shell for
both and let the media query only adjust spacing/sizing, not structure).

- [ ] **Step 2: Restructure the non-finished branch**

Keep `isMyTurn`, `noFlowInProgress`, and every socket emit unchanged. New
structure:

- **Top bar**: Bungee gradient "KUCHENDAL" wordmark (same treatment as
  `TopNav`'s logo), deck-count text, and a `ToastNarrator`-driven
  indicator is NOT here (that goes in the center stage per the design) —
  keep the top bar simple: logo + `Pioche restante: {state.deckCount}` +
  current-turn text (`Tour de : {name}{isMyTurn && " (toi)"}`).
- **Opponents row**: map `state.players.filter(p => p.id !== playerId)` to
  `PlayerAvatarBadge` (`size={64}`) + name + money display + card count.
  Money display for opponents is **always** the `moneyCount`-only view
  (opponents' exact money is never sent to this client — see
  `PlayerView.money: MoneyCard[] | null`), styled with `InfoStatusIcon`
  `status="partial"` next to the count (`{p.moneyCount} carte(s) argent`),
  matching the existing tooltip text verbatim ("Montant caché — seul le
  nombre de cartes est visible"). Give the active player's avatar the
  turn-glow ring (a CSS `@keyframes` pulsing border, applied when
  `p.id === state.activePlayerId`, reusing the same visual language as
  the Lobby's ready-glow but keyed to the accent color of that player's
  assigned index-based accent — reuse the 5-token accent rotation pattern
  already used in the design's opponents row).
- **Self roster info**: the current player's own exact money (`✅`
  replaced by `InfoStatusIcon status="known"`, same tooltip text
  "Montant exact connu (ta main)") and animal family counts move into the
  self-rail built in Task 7 — remove them from the shared player-list
  loop, this task's opponents row only covers non-self players.
- **Turn actions**: when `isMyTurn && noFlowInProgress`, the "Révéler une
  carte" button (`Button variant="primary"`) and `KuhhandelInitiator`
  (leave `KuhhandelInitiator`'s internals unstyled for this task — it's a
  small form, Task 8 can pick it up if time allows, but it's not
  explicitly in the design handoff's screens so isn't required reading
  for this plan; at minimum wrap its existing native `<select>`s/`<button>`
  in the CSS Module's basic form-field/button classes borrowed from
  `Input`/`Select`/`Button` so it doesn't look jarringly unstyled next to
  everything else — swap the raw elements for the `@kuhhandel/ui`
  components directly, same props, same handlers).
- **Narrator**: replace `NarratorFeed` with a single `ToastNarrator`
  showing the most recent `state.narratorFeed` entry (`state.narratorFeed
  [state.narratorFeed.length - 1]`), positioned in the center stage
  per the design (`position: relative` in a column, top-right style
  offset via CSS). `narratorStyle` prop: `GameStateView` doesn't expose
  which narrator style the room uses (see Global Constraints /
  spec — the field doesn't exist), so hardcode `narratorStyle="sport"`
  for now with a code comment noting this is a placeholder until
  `GameStateView` exposes the room's actual narrator style; render
  nothing if `narratorFeed` is empty (same as the old `NarratorFeed`'s
  empty-array early return).
- **Rare event banner**: keep the existing `RareEventBanner` function,
  restyle its rendered output with the design's spotlight-sweep treatment
  from `Kuchendal Succès & Événements Rares.dc.html` (a `position:
  relative` card with an absolutely-positioned sweeping gradient overlay
  `@keyframes`, `--kd-accent-yellow` border) instead of the current bare
  text — keep the `data-vfx` attribute and `playSound` call unchanged.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kuhhandel/web dev`, join/start a game with bots,
confirm: opponents render with avatars, turn-glow appears on the active
player, your own money/animals still show correctly (even though their
visual home moves to the self-rail in Task 7 — if Task 7 hasn't landed
yet, it's acceptable for this task's intermediate state to temporarily
keep the self info in the opponents-loop-adjacent spot; note in your
report if you left a `// TODO(Task 7)` marker), the "Révéler une carte"
button still starts an auction, narrator toast appears after actions
generate narrator messages, rare events (if triggered) show the spotlight
treatment. Stop the dev server after.

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/GameTable.tsx apps/web/components/GameTable.module.css
git commit -m "feat(web): restyle Table de jeu top bar, opponents row, narrator, rare events"
```

---

### Task 7: Table de jeu — self-rail with hand + bid stepper (`GameTable.tsx`/`AuctionPanel.tsx`, part 2)

**Files:**
- Modify: `apps/web/components/GameTable.tsx`
- Modify: `apps/web/components/AuctionPanel.tsx`
- Modify: `apps/web/components/GameTable.module.css`
- Create: `apps/web/components/AuctionPanel.module.css`

**Interfaces:**
- Consumes: `PlayingCard`, `InfoStatusIcon`, `Button` from `@kuhhandel/ui`;
  existing `useGameStore` selectors, `getSocket()` emits (`auction:bid`,
  `auction:pass`) — unchanged.
- Produces: the finished self-rail section of `GameTable.tsx`.

- [ ] **Step 1: Self-rail shell in `GameTable.tsx`**

Add a fixed-at-bottom rail (`border-top`, `--kd-surface` background,
`flex` row) containing: the current player's own avatar
(`PlayerAvatarBadge`) + `InfoStatusIcon status="known"` + exact money
total (moved here from Task 6's opponents loop, same tooltip text), the
player's animal hand rendered as a horizontally-scrolling row of
`PlayingCard` (`variant="animal"`, one per owned animal — `p.animals` on
the current player's `PlayerView`; `imageSlot` built as
`` `animal-${capitalize(a.species)}` `` — species keys are lowercase
ASCII (`cochon`, `chevre`, `ane`, ...) but the extracted artwork filenames
use capitalized, accented French names (`Cochon`, `Chèvre`, `Âne`, ...);
write a small local `SPECIES_IMAGE_SLOT: Record<SpeciesKey, string>`
lookup table in this file mapping all 10 species keys to their correct
artwork filename stem, matching exactly:
`cochon→Cochon, oie→Oie, mouton→Mouton, chevre→Chèvre, ane→Âne,
chien→Chien, chat→Chat, cheval→Cheval, boeuf→null (no artwork, see Phase
1), vache→Vache` — for `boeuf` pass an `imageSlot` that doesn't resolve to
a real file (`'animal-missing'`, same pattern the Phase 1 style-guide
page uses) so `PlayingCard`'s placeholder fallback renders correctly
instead of a broken image; `value` from
`SPECIES_FAMILY_VALUE[a.species]` — import both `SPECIES_IMAGE_SLOT`'s
source data needs and `SPECIES_FAMILY_VALUE` from
`@kuhhandel/game-engine`'s species config if it's exported from there, or
from `@kuhhandel/shared-types` if re-exported — check
`packages/shared-types/src/index.ts` and `packages/game-engine/src`'s
package exports for the actual importable path before writing the import;
if `SPECIES_FAMILY_VALUE` isn't currently exported from either package's
public entry point, add the export (a one-line addition to
`packages/shared-types/src/index.ts` re-exporting it from
`@kuhhandel/game-engine`) rather than hardcoding the value table a second
time in the frontend.

- [ ] **Step 2: Bid stepper + actions**

The `+`/`−` stepper and Enchérir/Passer/Vendre buttons are currently owned
by `AuctionPanel.tsx`, which today renders a *list of your money cards as
individual bid buttons* (bid = picking an exact card value you hold, not a
free-form incrementing amount — re-read `AuctionPanel.tsx` before
touching it, the existing UX is deliberately "your bids are real cards you
hold," not an arbitrary typed number, per the code comment already there
citing `05_UI_UX.md §4`). **Do not change this to a free-incrementing
+/− stepper** — that would contradict the existing, deliberate
"known-with-certainty" bid design. Instead, style the existing list of
money-card bid buttons as a horizontal row of small `PlayingCard`
(`variant="money"`) elements, each clickable (wrap in a `<button>` with no
default styling, or add an `onClick` + cursor pointer to a wrapping div),
disabled state (`card.value <= currentHighest`) rendered as reduced
opacity, replacing the current plain `<button>Enchérir {value}</button>`
list. Keep the `auction:bid`/`auction:pass`/`auction:sellerDecision` emits
and all existing conditions (`isSeller`, `isActiveBidder`,
`awaitingSellerDecision`) exactly as-is. Style the "Passer" button
(`Button variant="secondary"`) and seller-decision buttons ("Vendre"
`variant="primary"`, "Garder" `variant="secondary"`, same disabled
condition and tooltip as today).

Create `apps/web/components/AuctionPanel.module.css` for the money-card
row layout and the "current auction" summary line (`Meilleure offre : ...`
styled per the design's bid-ticker treatment — Bungee amount in
`--kd-accent-yellow`, `--kd-accent-cyan` bordered card).

- [ ] **Step 3: Center-stage auction card**

Back in `GameTable.tsx`, when `state.auction` is present, render the
auctioned animal as a large `PlayingCard` (`variant="animal"`, using the
same `SPECIES_IMAGE_SLOT` lookup) in the center stage next to the bid
panel, matching the design's two-column center-stage layout (card left,
bid ticker/panel right).

- [ ] **Step 4: Verify**

Run: `pnpm --filter @kuhhandel/web dev`, start an auction as the active
player, confirm: your hand renders as real card art (or the correct
placeholder for `boeuf`), the auction card displays large in the center,
bidding by clicking a money card still emits `auction:bid` with the right
amount and disables cards at/below the current highest, passing works,
and — as seller — the sell/keep buttons behave exactly as before. Stop the
dev server after.

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/GameTable.tsx apps/web/components/GameTable.module.css apps/web/components/AuctionPanel.tsx apps/web/components/AuctionPanel.module.css packages/shared-types/src/index.ts
git commit -m "feat(web): restyle self-rail hand/bidding and auction panel"
```

(Only include `packages/shared-types/src/index.ts` in the `git add` if
Step 1 actually required adding the re-export.)

---

### Task 8: Résolution de Kuhhandel (`KuhhandelPanel.tsx`)

**Files:**
- Modify: `apps/web/components/KuhhandelPanel.tsx`
- Create: `apps/web/components/KuhhandelPanel.module.css`

**Interfaces:**
- Consumes: `PlayingCard`, `InfoStatusIcon`, `Button`, `Select` from
  `@kuhhandel/ui`; existing `useGameStore` selectors, `getSocket()` emits
  (`turn:startKuhhandel`, `kuhhandel:submitOffer`, `kuhhandel:accept`,
  `kuhhandel:counter`) — unchanged.
- Produces: no new exports.

- [ ] **Step 1: Read the design reference and note the adaptation**

Read `~/Downloads/design_handoff_kuchendal/Kuchendal Résolution
Kuhhandel.dc.html`. Per this plan's spec, **omit** the countdown ring and
reveal-flip animation — there's no timed-reveal phase, resolution is
immediate on `kuhhandel:accept`/`kuhhandel:counter`. Keep the two-tray
"Challenger / Défenseur" visual language (face-down money-card-back trays
for hidden info) but drive it from the real stages
(`awaiting_initiator_offer`, `awaiting_response`) instead of a countdown.

- [ ] **Step 2: Restyle `KuhhandelInitiator`**

Swap the raw `<select>` elements for `@kuhhandel/ui`'s `Select`, the
submit button for `Button variant="primary"`. Keep every existing
condition (`eligibleTargets`, `currentTarget`, the `turn:startKuhhandel`
emit) unchanged.

- [ ] **Step 3: Restyle `MoneyPicker` and `KuhhandelPanel`**

`MoneyPicker` currently renders checkboxes for each money card. Restyle
as a row of small `PlayingCard` (`variant="money"`, `imageSlot="bill-
${value}"`) toggle buttons (selected state = accent-colored border ring,
e.g. a `.selected` class adding `outline` or a `box-shadow` using
`--kd-accent-pink`) instead of native checkboxes, keeping the exact same
`selected`/`toggle`/`onSubmit` logic. The "Envoyer l'offre
secrète"/"Contre-offrir" submit buttons become `Button variant="primary"`.

For the two "confidential" states (`awaiting_response` messages using
🔒), replace the emoji with `InfoStatusIcon status="partial"`, same
tooltip text, inside a two-tray layout: your own tray (money-back
`PlayingCard`s face-down when the offer is submitted but not yet visible
to you either — actually the initiator DOES know their own offer, so for
the initiator's own submitted-offer state, consider showing their actual
submitted amount instead of a lock icon, since it's their own known
data — check `kuhhandel.initiatorOffer`, which the server only sends back
to the initiator per `getPublicView`'s `canSeeOffer` check, so this data
is available client-side to render real card art for the initiator's own
offer once submitted) vs. the opponent's tray (always face-down/locked,
since a player never sees the other side's offer before resolution).

- [ ] **Step 4: Verify**

Run: `pnpm --filter @kuhhandel/web dev`, trigger a Kuhhandel between two
players with a shared species (bots work for this), confirm: the target
picker and species picker render styled, submitting an offer via the
money-card-toggle UI still emits the correct `moneyCardIds`, the
initiator sees their own submitted amount rendered as real cards while
awaiting response, the target sees a locked/hidden tray, accepting or
countering still works exactly as before. Stop the dev server after.

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/KuhhandelPanel.tsx apps/web/components/KuhhandelPanel.module.css
git commit -m "feat(web): restyle Résolution de Kuhhandel panel"
```

---

### Task 9: Fin de partie (`GameTable.tsx`'s `finished` branch)

**Files:**
- Modify: `apps/web/components/GameTable.tsx`
- Modify: `apps/web/components/GameTable.module.css`

**Interfaces:**
- Consumes: `PlayerAvatarBadge`, `Button` from `@kuhhandel/ui`; existing
  `useGameStore` selectors; `HallOfFameShame` (already exists in this
  file, keep as-is structurally, just restyle its output).
- Produces: no new exports.

- [ ] **Step 1: Read the design reference and note the adaptation**

Read `~/Downloads/design_handoff_kuchendal/Kuchendal Fin de Partie.dc.html`.
Per this plan's spec, replace the design's two buttons
("Rejouer"/"Retour au lobby") with a single "Retour au hub" button — no
`rematch` event exists. Wire it to clear the local game store back to the
Hub: call the store directly (the store doesn't currently expose a
`leave`/`reset` action — add one; see Step 3) rather than emitting a
socket event that doesn't exist.

- [ ] **Step 2: Restyle the `finished` branch**

Replace the current plain ranking `<ul>` with: a winner banner (Bungee
gradient text, "`{winner.name}` rafle tout !" using the top-scored
player), a CSS confetti background (absolutely-positioned falling
elements via a `@keyframes translateY` + `rotate`, generated from a small
array of 24 elements with staggered `animation-delay`, reusing the exact
technique and the 5-token accent color rotation from the design
reference), a ranking list using `PlayerAvatarBadge` (`size={40}`) per
row with rank-colored numerals (map rank 1/2/3 to
`--kd-accent-yellow`/`--kd-text-muted`/`--kd-accent-orange`, rank 4+ to
`--kd-text-subtle`), and the existing `HallOfFameShame` output restyled
as a grid of distinction cards (`--kd-surface`, colored left border or
full border per distinction, matching the design's Hall of Shame/Fame
card grid — since `DISTINCTION_LABELS` doesn't carry a color, assign
colors by cycling through the same 5-accent rotation used elsewhere by
array index).

- [ ] **Step 3: Add a `leave` action to the game store**

In `apps/web/store/gameStore.ts`, add to the `GameStore` interface and
implementation:
```ts
leave: () => void;
```
```ts
leave: () => set({ roomCode: null, playerId: null, state: null }),
```
(Same shape as the existing `lobby:kicked` handler's `set(...)` call —
this is a pure local-state reset, no socket emit, since there's no
server-side "leave" concept to notify.) Wire the new "Retour au hub"
button's `onClick` to `useGameStore((s) => s.leave)`.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @kuhhandel/web dev`, play a game to completion (or use
a short bot-filled game if feasible) to reach the `finished` state,
confirm: winner banner, confetti, ranking, and Hall of Shame/Fame render
correctly, and "Retour au hub" returns you to the Hub screen (`Join`/`Hub`
state, i.e. `!playerId || !state`). Stop the dev server after.

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/GameTable.tsx apps/web/components/GameTable.module.css apps/web/store/gameStore.ts
git commit -m "feat(web): restyle Fin de partie screen, add leave-to-hub action"
```

---

### Task 10: Profil screen (`Profile.tsx`, absorbs `MatchHistory.tsx`)

**Files:**
- Modify: `apps/web/components/Profile.tsx`
- Modify: `apps/web/components/MatchHistory.tsx`
- Create: `apps/web/components/Profile.module.css`

**Interfaces:**
- Consumes: `PlayerAvatarBadge`, `RarityFrame` (+ `Rarity` type) from
  `@kuhhandel/ui`; existing `lib/profile` functions — unchanged; renders
  `MatchHistory` inline instead of the Hub rendering it separately.
- Produces: no new exports.

- [ ] **Step 1: Read the design reference and note the adaptation**

Read `~/Downloads/design_handoff_kuchendal/Kuchendal Profil Public.dc.html`.
Per this plan's spec, the 4 stat tiles become Niveau / XP / Badges
débloqués / Titres débloqués (all real fields on `ProfileData`), not the
design's Parties jouées/Victoires/Argent max/Niveau (not backed).

- [ ] **Step 2: Restyle `Profile.tsx`**

Keep `loadProfile`/`setActiveTitle` and the `useEffect` unchanged. Build:
hero row (`PlayerAvatarBadge` `size={100}`, no image so initial-letter
fallback; the design's `status`/glow border on the avatar circle —
`PlayerAvatarBadge` already renders a `RarityFrame` ring around any
avatar, default `rarity="commun"`; there's no per-user "avatar rarity"
concept, so leave it at the default), the active title as a pill (find the
title whose `id === profile.currentTitleId` in `profile.titles`, or
"Aucun titre actif" if null), the 4 stat tiles in a grid, a badges grid
where each badge renders inside a `RarityFrame` (`shape="badge"`,
`size={56}`) — map `badge.rarity` (a raw string from the DB, values
`commun|rare|epique|legendaire|mythique|secret|ultra_secret`) to
`RarityFrame`'s `Rarity` type via a small local function
`toRarity(dbRarity: string): Rarity` that replaces `ultra_secret` with
`'ultra-secret'` and passes everything else through unchanged (with a
`satisfies Rarity` or explicit return type so a future rarity mismatch is
a type error, not a silent fallback) — inside each `RarityFrame`, show the
badge name below it, same as the design's badge-grid cells (name below the
frame, no icon inside the frame besides its color, matching the design's
own reference file which also has no icon), the achievements list, and
finally the match history section.

- [ ] **Step 3: Fold `MatchHistory` in**

Restyle `MatchHistory.tsx`'s output (a styled list of rows, `--kd-surface`
background, win/loss indicated by an `InfoStatusIcon`-style colored dot
or just the existing text with `--kd-accent-green`/`--kd-text-muted`
coloring for "Terminée"/"En cours" — keep it simple, a colored left border
per row is enough, no need to force `InfoStatusIcon` in here since it's
not an information-certainty concept). Keep the Supabase query and props
(`userId`) unchanged. Render `<MatchHistory userId={userId} />` at the
bottom of `Profile.tsx`'s JSX, after achievements, under a "Historique
récent" section label — this is the only change needed in `Profile.tsx`
to absorb it (it was already a standalone component, just needs to be
composed here instead of separately toggled from the Hub, which Task 3
already stopped doing).

- [ ] **Step 4: Verify**

Run: `pnpm --filter @kuhhandel/web dev`, navigate to Profil from the Hub
nav, confirm: hero/stats/title/badges/achievements/match-history all
render (empty states are fine for a fresh test account), setting an active
title (if the account has any unlocked) still calls `setActiveTitle` and
refreshes correctly. Stop the dev server after.

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/Profile.tsx apps/web/components/Profile.module.css apps/web/components/MatchHistory.tsx
git commit -m "feat(web): restyle Profil screen, fold in match history"
```

---

### Task 11: Classements screen (`Leaderboards.tsx`)

**Files:**
- Modify: `apps/web/components/Leaderboards.tsx`
- Create: `apps/web/components/Leaderboards.module.css`

**Interfaces:**
- Consumes: existing `lib/leaderboard` functions/types — unchanged.
- Produces: no new exports.

- [ ] **Step 1: Read the design reference and note the adaptation**

Read `~/Downloads/design_handoff_kuchendal/Kuchendal Classements.dc.html`.
Per this plan's spec, only 2 tabs (Global/Amis) — `LeaderboardScope` has
no `'weekly'` value, don't add a third tab.

- [ ] **Step 2: Restyle**

Keep `category`/`scope` state and the `loadLeaderboard` effect unchanged
(the `category` selector — XP/Victoires/Bluffs/Badges — stays as a
`Select` from `@kuhhandel/ui` rather than becoming a tab row, since the
design only shows scope as tabs, category as a separate selector is this
app's own addition and still needs a control; keep it as a styled
`Select` above or beside the scope tabs). Scope tabs
(`global`/`friends`) styled per the design's tab-pill treatment (filled
pink background + border when active, transparent + neutral border
otherwise — same pattern as the Lobby narrator-style-picker mockup and
the Direction Artistique reference's "selected/unselected" convention).
Ranking list: rank-colored numerals for top 3 (same color mapping as
Task 9's Fin de partie ranking: yellow/muted/orange), `entry.username`
highlighted (bold or accent-colored) when `entry.userId === userId`,
`entry.value` in Bungee font, `--kd-accent-yellow`.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kuhhandel/web dev`, navigate to Classements from the
Hub nav, confirm: category selector and scope tabs both work and refetch,
loading/empty states render, your own row is visually distinguished when
present. Stop the dev server after.

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/Leaderboards.tsx apps/web/components/Leaderboards.module.css
git commit -m "feat(web): restyle Classements screen"
```

---

### Task 12: Paramètres screen (new `Settings.tsx`) + wire into Hub

**Files:**
- Create: `apps/web/components/Settings.tsx`
- Create: `apps/web/components/Settings.module.css`
- Create: `apps/web/lib/preferences.ts`
- Modify: `apps/web/lib/sound.ts`
- Modify: `apps/web/components/Hub.tsx` (replace the Task-3 stub with the
  real `<Settings />`)

**Interfaces:**
- Consumes: `Button`, `Input`, `PlayerAvatarBadge` from `@kuhhandel/ui`;
  `useAuthStore` (`profile`, `signOut`); `NarratorStyle` type from
  `@kuhhandel/shared-types`.
- Produces:
  ```ts
  // apps/web/lib/preferences.ts
  import type { NarratorStyle } from '@kuhhandel/shared-types';
  export function getDefaultNarratorStyle(): NarratorStyle;
  export function setDefaultNarratorStyle(style: NarratorStyle): void;
  export function getSoundEnabled(): boolean;
  export function setSoundEnabled(enabled: boolean): void;
  ```
  Consumed by `apps/web/lib/sound.ts` (Step 2) and by `Hub.tsx`'s
  create-game form (Step 4) to pre-fill the narrator-style select. Reuses
  `NarratorStyle` from `@kuhhandel/shared-types` rather than declaring a
  second, duplicate 4-literal union — that type already exists and is
  already imported by `Hub.tsx` for the same create-game form.

- [ ] **Step 1: Write the local-preferences module**

Create `apps/web/lib/preferences.ts`:

```ts
// Client-only preferences (no backend persistence exists for these yet —
// see docs/superpowers/specs/2026-07-28-full-screen-uiux-design.md).
import type { NarratorStyle } from "@kuhhandel/shared-types";

const NARRATOR_STYLE_KEY = "kuchendal:defaultNarratorStyle";
const SOUND_ENABLED_KEY = "kuchendal:soundEnabled";
const NARRATOR_STYLES: NarratorStyle[] = ["sport", "documentary", "western", "tv"];

function readLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private browsing, quota) — safe to ignore.
  }
}

export function getDefaultNarratorStyle(): NarratorStyle {
  const stored = readLocalStorage(NARRATOR_STYLE_KEY);
  return (NARRATOR_STYLES as string[]).includes(stored ?? "")
    ? (stored as NarratorStyle)
    : "sport";
}

export function setDefaultNarratorStyle(style: NarratorStyle): void {
  writeLocalStorage(NARRATOR_STYLE_KEY, style);
}

export function getSoundEnabled(): boolean {
  const stored = readLocalStorage(SOUND_ENABLED_KEY);
  return stored === null ? true : stored === "true";
}

export function setSoundEnabled(enabled: boolean): void {
  writeLocalStorage(SOUND_ENABLED_KEY, String(enabled));
}
```

- [ ] **Step 2: Gate `playSound` on the sound preference**

Modify `apps/web/lib/sound.ts`: import `getSoundEnabled` from
`./preferences` and add an early return at the top of `playSound`:
```ts
export function playSound(key: string): void {
  if (typeof window === "undefined" || !getSoundEnabled()) return;
  // ...rest unchanged
```

- [ ] **Step 3: Write `Settings.tsx`**

Read `~/Downloads/design_handoff_kuchendal/Kuchendal Paramètres.dc.html`
for the layout: avatar + pseudo card, preferences card (narrator style +
3 toggles), danger-zone card. Per this plan's spec:

- Avatar: `PlayerAvatarBadge` (`size={64}`, initial-letter fallback).
  "Changer l'avatar" button: `Button variant="secondary"`, `disabled`,
  with a `title="Bientôt disponible — pas encore de système d'avatars"`.
- Pseudo: `Input` with `value={profile.username}` and `readOnly`, no
  `onChange` handler (there's no update mutation) — add a small
  `--kd-text-subtle` caption below it: "Modifiable prochainement."
- Narrator style: a `<div>` of buttons (not `Select`, matches the design's
  vertical button-list picker), one per style, selected = filled pink
  background, calling `setDefaultNarratorStyle(id)` on click and reading
  the current value from `getDefaultNarratorStyle()` via local
  `useState` initialized in the component body (client-only, fine to read
  `localStorage` directly on mount inside a `useEffect` if you want to
  avoid SSR/client mismatch — initialize state to `"sport"` then correct
  it in a `useEffect` on mount, this avoids a hydration warning since the
  server can't know `localStorage`'s value).
- Toggles: sound (real — reads/writes `getSoundEnabled`/`setSoundEnabled`,
  same custom-switch look as the design: sliding knob, `--kd-accent-green`
  when on), music and notifications (render the same switch UI but
  `disabled`, with a caption "Bientôt disponible" under each — do NOT
  wire these to fake local state that implies they do something, since
  no music/notification system exists to control).
- Danger zone: "Se déconnecter" (`Button variant="secondary"`, calls
  `useAuthStore((s) => s.signOut)`), "Supprimer le compte"
  (`Button variant="danger"`, `disabled`, `title="Bientôt disponible —
  contacte le support pour une suppression manuelle"`).

- [ ] **Step 4: Wire the narrator-style default into Hub's create-game form**

In `apps/web/components/Hub.tsx`, change the `narratorStyle` state's
initializer from a hardcoded `"sport"` to
`useState<NarratorStyle>(getDefaultNarratorStyle())`, importing
`getDefaultNarratorStyle` from `../lib/preferences` (its return type is
already `NarratorStyle` from `@kuhhandel/shared-types`, so no cast is
needed — `Hub.tsx` already imports `NarratorStyle` for this state, reuse
that same import).

- [ ] **Step 5: Replace the Hub's Task-3 stub**

In `apps/web/components/Hub.tsx`, replace the `view === "parametres"`
stub (`<p>Bientôt disponible.</p>`) with `<Settings />`, and remove the
now-resolved `// TODO(Task 12)` comment.

- [ ] **Step 6: Verify**

Run: `pnpm --filter @kuhhandel/web dev`, navigate to Paramètres from the
Hub nav, confirm: pseudo shows correctly (read-only), narrator-style
picker changes the selection and persists across a page reload (check
`localStorage`), sound toggle flips and persists, music/notification
toggles are visibly disabled, "Se déconnecter" logs you out, disabled
buttons show their tooltip on hover. Then go back to the Hub and confirm
the create-game narrator-style select now defaults to whatever you last
picked in Paramètres. Stop the dev server after.

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/Settings.tsx apps/web/components/Settings.module.css apps/web/lib/preferences.ts apps/web/lib/sound.ts apps/web/components/Hub.tsx
git commit -m "feat(web): add Paramètres screen, local sound/narrator preferences"
```

---

### Task 13: Final polish pass, `DESIGN_ASSETS.md` update, gap report

**Files:**
- Modify: `docs/DESIGN_ASSETS.md`
- Modify: any file where the verification step below finds a real bug
  (see Step 2 — this task is allowed to make small targeted fixes across
  files touched by Tasks 1-12, but must not restyle anything net-new;
  it's a QA pass, not a 14th screen)

**Interfaces:**
- Consumes: the entire app, all prior tasks' work.
- Produces: nothing new — terminal task.

- [ ] **Step 1: Full production build**

Run: `pnpm --filter @kuhhandel/web build` (supplying dummy
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars if the
pre-existing missing-env-var issue from Phase 1's final review is still
unresolved — check whether a `.env`/`.env.local` now exists before
assuming it's still broken). Confirm it succeeds.

Run: `pnpm -r typecheck && pnpm -r lint` (full workspace, not just
`apps/web` — confirms nothing in `packages/shared-types` broke if Task 7
added a re-export).

- [ ] **Step 2: Full manual walkthrough in a real browser**

Run: `pnpm --filter @kuhhandel/web dev`. Walk every transition end to end:
sign out → Accueil (both tabs) → sign in → Hub (nav to Profil,
Classements, Paramètres and back) → create a room → Lobby (as host, add a
bot or two) → start the game → Table de jeu (trigger an auction, bid,
resolve it; trigger a Kuhhandel if 2+ players share a species, resolve
it) → play to `finished` → Fin de partie → "Retour au hub". Note any
visual regression, broken layout, or console error and fix it directly
(small, targeted CSS/JSX fixes only — if something needs a structural
change bigger than a few lines, that's a finding for the eventual
whole-branch review, not something to silently rework here).

- [ ] **Step 3: Update `docs/DESIGN_ASSETS.md`**

Check off every §5 screen item now genuinely restyled (Accueil, Hub,
Lobby, Table de jeu desktop+mobile, Résolution d'enchère, Résolution de
Kuhhandel, Fin de partie, Profil public, Classements, Paramètres de
compte). Check off the §3 status-icon item's remaining reference to
KuhhandelPanel/GameTable being actually wired now (if not already ticked
in Phase 1). Leave unchecked, with a short inline note where useful,
anything genuinely still missing: avatar image set (§4), profile frame
art beyond `RarityFrame` reuse, emotes, card foil skin, narrator/badge
icon art (note: not actually needed per the design's own reference files —
consider whether to strike these sub-items rather than leave them
perpetually unchecked, your call, explain your reasoning in the commit
message either way).

- [ ] **Step 4: Compile the gap report**

Write a short summary (as the commit message body, not a new file) listing
every backend/asset gap this phase adapted around instead of building
fake functionality: guest play, lobby narrator-style live-edit + rounds
config, per-player ready flags, auction bid history, Kuhhandel countdown/
timed reveal, rematch, username/avatar editing, account deletion, sound
files (binary assets), background music system, notification system,
win/game-count aggregate stats for the profile stat tiles, "weekly"
leaderboard scope, the 16 predefined avatar images, and the foil card
skin (needs player-level data plumbed into `GameStateView`).

- [ ] **Step 5: Commit**

```bash
git add docs/DESIGN_ASSETS.md
git add -A  # plus any small fixes from Step 2
git commit -m "$(cat <<'EOF'
Phase 2 final polish: full walkthrough fixes, DESIGN_ASSETS.md update

<gap report from Step 4 goes here>
EOF
)"
```
