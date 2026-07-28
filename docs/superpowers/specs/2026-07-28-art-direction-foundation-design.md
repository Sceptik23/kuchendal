# Kuchendal — Phase 1: Art Direction Foundation

## Context

Kuchendal's frontend and realtime server are live but functionally unstyled
(`apps/web/app/globals.css` is nearly empty; `packages/ui` is an empty stub).
A high-fidelity design handoff (`~/Downloads/design_handoff_kuchendal/`, 15
`.dc.html` prototype files + README + asset sidecar) specifies a complete
psychedelic/fluo-on-near-black visual direction: palette, typography, shape
language, and per-screen layouts for all 11 core screens plus reference
catalogs (badges, avatars, rare events).

This spec covers **only the first slice**: the shared design-token system and
reusable UI primitives that every screen will be built on top of. Individual
screens, sound/VFX, and the full badges/avatars/titles catalog are deferred
to later phases (tracked in `docs/DESIGN_ASSETS.md`).

## Decisions carried over from brainstorming

- **Palette supersedes the old spec.** `docs/DESIGN_ASSETS.md` (derived from
  `05_UI_UX.md`) called for an earthy palette (prairie green/barn
  orange/straw yellow). The handoff's near-black neon palette is explicitly
  marked "final decisions, not placeholders" and replaces it entirely.
- **Card values in the handoff mockups are illustrative only.** The handoff's
  example animal point values (Poule 10, Oie 40, …) don't match the real
  game data in `packages/game-engine/src/config/species.config.ts` (Cochon
  100, Oie 200, Mouton 300, Chèvre 400, Âne 500, Chien 650, Chat 800, Cheval
  1000, Bœuf 1200, Vache 1500). The **species names match exactly** and the
  artwork in the sidecar JSON is keyed by species name (`animal-Poule`,
  `animal-Cochon`, …) and by bill value (`bill-0` … `bill-500`, which do
  match `money.config.ts`'s `MONEY_DENOMINATIONS` exactly). So artwork
  extraction and wiring is unaffected — displayed point values always come
  from the real game config, never from the mockup.
- **Styling approach:** CSS custom properties for tokens + CSS Modules per
  component. No new framework dependency (no Tailwind), consistent with the
  app's current minimal setup.
- **Fonts:** loaded via `next/font/google` (Bungee, Space Grotesk) rather
  than a runtime `<link>` tag, for Next.js's built-in font optimization.
- **Assets:** the 16 real webp illustrations (10 animal cards + 6 money
  bills) already present in the handoff's `.image-slots.state.json` are
  extracted to static files and wired into the card component now, not left
  as placeholders.

## Scope

### 1. Design tokens

New `packages/ui/src/tokens.css`, imported as a side effect from
`packages/ui/src/index.ts`:

- Colors (OKLCH): `--kd-bg`, `--kd-surface`, `--kd-border`, and 5 accents
  (`--kd-accent-green`, `--kd-accent-pink`, `--kd-accent-cyan`,
  `--kd-accent-yellow`, `--kd-accent-orange`), values taken verbatim from the
  handoff README's Design Tokens section.
- Radii scale (12–20px), a glow-shadow helper per accent (used instead of
  drop shadows, per the handoff's shape language), and a spacing scale.
- Font-family custom properties (`--kd-font-display`, `--kd-font-body`)
  populated from the `next/font` CSS variables set up in step 2.

`apps/web/app/globals.css` imports the token stylesheet and sets `body`
background/color/font defaults to match the handoff (near-black background,
Space Grotesk body text).

### 2. Fonts

`apps/web/app/layout.tsx` loads Bungee and Space Grotesk (weights 400–700)
via `next/font/google`, exposing them as CSS variables on `<html>`/`<body>`
that feed the token file's font vars. No runtime Google Fonts `<link>` tags.

### 3. Component primitives (`packages/ui/src`, one folder per component, CSS
Modules)

- **`Button`** — primary (filled acid green), secondary (outline, neutral or
  accent border), danger (filled magenta) variants; Bungee label, per the
  handoff's button treatment (filled = solid accent bg + dark text, outline =
  transparent + 2px accent border).
- **`PlayingCard`** — animal or money variant. Neon border + matching glow
  keyed to an accent color; renders artwork from `/cards/<slot-id>.webp` when
  available, otherwise a placeholder pattern (the repeating-diagonal-stripe
  treatment from the handoff) with a text label. Displays the real value
  passed in as a prop — never a hardcoded value from the mockup.
- **`PlayerAvatarBadge`** — circular avatar (image or placeholder pattern) +
  online-status dot, optionally wrapped in a `RarityFrame`.
- **`RarityFrame`** — wrapper implementing the 7-tier system (Commun, Rare,
  Épique, Légendaire, Mythique, Secret, Ultra-secret), including the
  `holo-spin` animated conic-gradient border for Ultra-secret. Used by
  `PlayerAvatarBadge` and available standalone for badges elsewhere.
- **`ToastNarrator`** — speech-bubble component; background/border color and
  label driven by a `narratorStyle` prop (styling only in this phase — the 4
  narrator identities' full treatment, icon etc., is a later phase per
  `docs/DESIGN_ASSETS.md` §6).
- **`Input`** / **`Select`** — base form field styling matching the token
  system (dark surface, neutral border, accent border on focus).
- **Status icons** — restyled "known with certainty" / "partially known"
  indicators replacing the current ✅/🔒 placeholders, using shapes/accent
  colors instead of emoji, ready to drop into `KuhhandelPanel.tsx`.

Each component is exported from `packages/ui/src/index.ts`.

### 4. Asset extraction

A one-off Node/TS script reads
`~/Downloads/design_handoff_kuchendal/.image-slots.state.json`, decodes the
`u` (data URL) field for each of the 16 entries, and writes:

- `apps/web/public/cards/animal-<Species>.webp` for the 10 animal slots
  (`animal-Poule`, `animal-Oie`, `animal-Chat`, `animal-Chien`,
  `animal-Mouton`, `animal-Chèvre`, `animal-Âne`, `animal-Cochon`,
  `animal-Vache`, `animal-Cheval`)
- `apps/web/public/cards/bill-<Value>.webp` for the 6 money slots
  (`bill-0`, `bill-10`, `bill-50`, `bill-100`, `bill-200`, `bill-500`)

The script itself is not committed as a permanent tool (throwaway, run once);
only the resulting webp files are committed.

## Out of scope (tracked in `docs/DESIGN_ASSETS.md` for later phases)

- Any individual screen's layout (Accueil, Hub, Lobby, Table de jeu,
  résolutions, Fin de partie, Profil, Classements, Paramètres).
- Sound/VFX, rare-event animations, badges/titres/distinctions catalogs,
  avatar cosmetics beyond the card art extracted here.
- `docs/DESIGN_ASSETS.md` §0–§3 get their checkboxes ticked for what this
  phase delivers; the rest stays unchecked.

## Verification

- `pnpm --filter @kuhhandel/web dev`, visually inspect each primitive
  rendered together on a scratch route against the handoff's Direction
  Artistique file and README token values.
- `pnpm typecheck` and `pnpm lint` pass across `packages/ui` and `apps/web`.
- Confirm the 16 extracted webp files exist and load in the `PlayingCard`
  component with correct species/value pairing per the real game config.
