# Art Direction Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up Kuchendal's design-token system and eight reusable UI primitives (Button, PlayingCard, RarityFrame, PlayerAvatarBadge, ToastNarrator, Input, Select, InfoStatusIcon) in `packages/ui`, plus extract the 16 real card/bill illustrations already supplied in the design handoff — the shared foundation every screen will be built on next.

**Architecture:** `packages/ui` becomes a real React component library (currently an empty stub) consumed by `apps/web` via the existing `workspace:*` dependency. Design tokens live as CSS custom properties in one file (`packages/ui/src/tokens.css`), imported once globally from `apps/web/app/globals.css`. Each component gets its own folder with a `.tsx` file and a co-located CSS Module, matching the "smaller, focused files" pattern — no component touches another's internals, they compose only through props.

**Tech Stack:** Next.js 15 (App Router) / React 19, plain CSS (custom properties + CSS Modules, no new framework dependency), `next/font/google` for Bungee + Space Grotesk, pnpm workspaces.

## Global Constraints

- Palette, type, radii, and glow values are copied verbatim from the design handoff README (`~/Downloads/design_handoff_kuchendal/README.md`) — do not invent or approximate OKLCH values.
- Card/bill **point values** always come from the real game config
  (`packages/game-engine/src/config/species.config.ts`,
  `packages/game-engine/src/config/money.config.ts`), never from the design
  handoff's example numbers.
- No new test framework is introduced in this phase (`packages/ui` and
  `apps/web` both currently have `"test": "echo \"no tests yet\"..."` — that's
  out of scope here). Verification per task is: `pnpm typecheck`, `pnpm lint`,
  and, where noted, a manual visual check via the dev server. The final task
  adds a `/style-guide` route that renders every primitive together for that
  manual check, matching the spec's Verification section.
- Components that use React state/effects need `"use client"`; purely
  presentational components with no hooks do not.
- Styling: CSS custom properties (tokens) + CSS Modules per component. No
  Tailwind, no CSS-in-JS library.
- Species artwork note: the handoff's 10 animal art slots are keyed by
  species **name** (`animal-Poule`, `animal-Oie`, `animal-Chat`,
  `animal-Chien`, `animal-Mouton`, `animal-Chèvre`, `animal-Âne`,
  `animal-Cochon`, `animal-Vache`, `animal-Cheval`). The real game has 10
  species too, but one differs: `boeuf` (ox) is a real species with **no**
  matching artwork, while `animal-Poule` (chicken) has artwork but is **not**
  a real species. Extract all 16 files as-is; do not rename or fabricate a
  `boeuf` image — `PlayingCard`'s missing-image fallback (Task 7) handles
  this correctly, and the style-guide page (Task 11) deliberately exercises
  it for `boeuf`.

---

### Task 1: `packages/ui` package setup (React + shared-types deps)

**Files:**
- Modify: `packages/ui/package.json`
- Modify: `packages/ui/tsconfig.json`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `packages/ui` is installable/typecheckable as a React component
  library; `packages/ui/src/index.ts` is an empty barrel (no exports yet —
  later tasks append to it) that later tasks add `export` lines to.

- [ ] **Step 1: Update `packages/ui/package.json`**

Replace its contents with:

```json
{
  "name": "@kuhhandel/ui",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "echo \"no tests yet\" && exit 0",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@kuhhandel/shared-types": "workspace:*"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.2",
    "react": "^19.0.0",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Add DOM lib to `packages/ui/tsconfig.json`**

`tsconfig.base.json`'s `lib` is `["ES2022"]` only (no DOM types), which
every other package is fine with, but this package needs DOM types for JSX
(e.g. `HTMLButtonElement`). Update `packages/ui/tsconfig.json` to:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Empty the barrel file**

Replace `packages/ui/src/index.ts` contents (currently just the unused
`UI_PACKAGE_VERSION` constant) with an empty file containing only this
comment, so later tasks have a clear anchor to append `export` lines below:

```ts
// Barrel — component exports appended by later tasks.
```

- [ ] **Step 4: Install and verify**

Run: `pnpm install && pnpm --filter @kuhhandel/ui typecheck`
Expected: install succeeds, typecheck passes with no errors (nothing to
check yet, but confirms the config is valid).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/package.json packages/ui/tsconfig.json packages/ui/src/index.ts pnpm-lock.yaml
git commit -m "chore(ui): set up packages/ui as a React component library"
```

---

### Task 2: Design tokens + fonts

**Files:**
- Create: `packages/ui/src/tokens.css`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: the full set of CSS custom properties every later component
  relies on: `--kd-bg`, `--kd-surface`, `--kd-surface-alt`, `--kd-border`,
  `--kd-text`, `--kd-text-muted`, `--kd-text-subtle`, `--kd-accent-green`,
  `--kd-accent-pink`, `--kd-accent-cyan`, `--kd-accent-yellow`,
  `--kd-accent-orange`, `--kd-rarity-commun`, `--kd-rarity-rare`,
  `--kd-rarity-epique`, `--kd-rarity-legendaire`, `--kd-rarity-mythique`,
  `--kd-rarity-secret`, `--kd-radius-sm/md/lg`, `--kd-space-1..8`,
  `--kd-font-display`, `--kd-font-body`, the `kd-holo-spin` keyframe and
  `--kd-holo-angle` custom property (used by Task 5's RarityFrame).

- [ ] **Step 1: Write the token stylesheet**

Create `packages/ui/src/tokens.css`:

```css
/* Kuchendal design tokens — values copied verbatim from the design handoff
   README (OKLCH, psychedelic/fluo direction on a near-black base). */
:root {
  /* Base surfaces */
  --kd-bg: oklch(14% 0.02 300);
  --kd-surface: oklch(20% 0.03 300);
  --kd-surface-alt: oklch(18% 0.02 300);
  --kd-border: oklch(28% 0.02 300);

  /* Text */
  --kd-text: oklch(96% 0.01 300);
  --kd-text-muted: oklch(75% 0.02 300);
  --kd-text-subtle: oklch(65% 0.02 300);

  /* Accents — never more than 1-2 active at once per screen */
  --kd-accent-green: oklch(78% 0.27 140);
  --kd-accent-pink: oklch(70% 0.28 340);
  --kd-accent-cyan: oklch(80% 0.16 200);
  --kd-accent-yellow: oklch(88% 0.19 100);
  --kd-accent-orange: oklch(72% 0.19 45);

  /* Rarity frame system (7 tiers) — ultra-secret is handled separately via
     the holo conic-gradient below, it has no flat color. */
  --kd-rarity-commun: oklch(60% 0.02 300);
  --kd-rarity-rare: var(--kd-accent-cyan);
  --kd-rarity-epique: var(--kd-accent-pink);
  --kd-rarity-legendaire: var(--kd-accent-orange);
  --kd-rarity-mythique: var(--kd-accent-yellow);
  --kd-rarity-secret: var(--kd-accent-green);

  /* Shape */
  --kd-radius-sm: 12px;
  --kd-radius-md: 16px;
  --kd-radius-lg: 20px;

  /* Spacing */
  --kd-space-1: 4px;
  --kd-space-2: 8px;
  --kd-space-3: 12px;
  --kd-space-4: 16px;
  --kd-space-5: 24px;
  --kd-space-6: 32px;
  --kd-space-7: 48px;
  --kd-space-8: 64px;

  /* Fonts — --font-bungee / --font-space-grotesk are set on <html> by
     next/font in apps/web/app/layout.tsx. */
  --kd-font-display: var(--font-bungee), cursive;
  --kd-font-body: var(--font-space-grotesk), sans-serif;
}

/* Animated holographic border for the Ultra-secret rarity tier. */
@keyframes kd-holo-spin {
  from {
    --kd-holo-angle: 0deg;
  }
  to {
    --kd-holo-angle: 360deg;
  }
}

@property --kd-holo-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
```

- [ ] **Step 2: Import tokens and set body defaults in `apps/web/app/globals.css`**

Replace `apps/web/app/globals.css` contents with:

```css
@import '@kuhhandel/ui/src/tokens.css';

body {
  margin: 0;
  background: var(--kd-bg);
  color: var(--kd-text);
  font-family: var(--kd-font-body);
}

/* 06_AUDIO_VFX.md §3: brief cosmetic pulse for a rare event's spotlight moment. */
@keyframes pulse {
  0% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.4;
  }
}
```

- [ ] **Step 3: Load fonts in `apps/web/app/layout.tsx`**

Replace `apps/web/app/layout.tsx` contents with:

```tsx
import { Bungee, Space_Grotesk } from 'next/font/google';
import './globals.css';

const bungee = Bungee({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bungee',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata = {
  title: 'Kuchendal',
  description: "Jeu multijoueur d'enchères et de bluff en temps réel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${bungee.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

Bungee only ships a single weight (400) on Google Fonts, hence `weight:
'400'` (not an array) — passing an array of unsupported weights throws a
build-time error in `next/font/google`.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @kuhhandel/web dev`, open `http://localhost:3000`.
Expected: page background is near-black (`oklch(14% 0.02 300)`), no console
errors about the font or the `@import`. Stop the dev server after checking.

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/tokens.css apps/web/app/globals.css apps/web/app/layout.tsx
git commit -m "feat(ui): add design tokens and load Bungee/Space Grotesk fonts"
```

---

### Task 3: Extract card & bill artwork

**Files:**
- Create (temporary, deleted at end of task): `scripts/extract-card-art.mjs`
- Create: `apps/web/public/cards/animal-Poule.webp`,
  `animal-Oie.webp`, `animal-Chat.webp`, `animal-Chien.webp`,
  `animal-Mouton.webp`, `animal-Chèvre.webp`, `animal-Âne.webp`,
  `animal-Cochon.webp`, `animal-Vache.webp`, `animal-Cheval.webp`,
  `bill-0.webp`, `bill-10.webp`, `bill-50.webp`, `bill-100.webp`,
  `bill-200.webp`, `bill-500.webp` (16 files total)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: static files at `/cards/<slotId>.webp`, served by Next from
  `apps/web/public/`. `PlayingCard` (Task 7) resolves images by building
  this exact path from its `imageSlot` prop.

- [ ] **Step 1: Write the extraction script**

Create `scripts/extract-card-art.mjs` at the repo root:

```js
// One-off script: decodes the base64 webp artwork already dropped into the
// design handoff's image-slot placeholders into real static files. Not a
// permanent tool — delete after running (see plan Task 3, Step 3).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SOURCE = '/Users/jonathanbraun/Downloads/design_handoff_kuchendal/.image-slots.state.json';
const OUT_DIR = path.join(fileURLToPath(new URL('.', import.meta.url)), 'apps/web/public/cards');

const data = JSON.parse(readFileSync(SOURCE, 'utf8'));
mkdirSync(OUT_DIR, { recursive: true });

for (const [slotId, slot] of Object.entries(data)) {
  const match = /^data:image\/webp;base64,(.+)$/.exec(slot.u);
  if (!match) {
    throw new Error(`Unexpected data URL format for slot "${slotId}"`);
  }
  const buffer = Buffer.from(match[1], 'base64');
  writeFileSync(path.join(OUT_DIR, `${slotId}.webp`), buffer);
  console.log(`wrote ${slotId}.webp (${buffer.length} bytes)`);
}
```

- [ ] **Step 2: Run it**

Run: `node scripts/extract-card-art.mjs`
Expected: 16 lines of `wrote <slotId>.webp (<n> bytes)` output, one per slot
listed in the Files section above.

Run: `ls apps/web/public/cards | wc -l`
Expected: `16`

- [ ] **Step 3: Delete the script**

```bash
rm scripts/extract-card-art.mjs
rmdir scripts 2>/dev/null || true
```

- [ ] **Step 4: Commit the extracted images only**

```bash
git add apps/web/public/cards
git commit -m "feat(assets): extract animal/bill card artwork from design handoff"
```

---

### Task 4: `Button` component

**Files:**
- Create: `packages/ui/src/Button/Button.tsx`
- Create: `packages/ui/src/Button/Button.module.css`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: tokens from Task 2 (`--kd-font-display`, `--kd-radius-sm`,
  `--kd-accent-green`, `--kd-accent-cyan`, `--kd-accent-pink`, `--kd-bg`,
  `--kd-text`).
- Produces: `Button` component, `ButtonProps`, `ButtonVariant` type
  (`'primary' | 'secondary' | 'danger'`), all exported from
  `@kuhhandel/ui`. Used standalone (no other component depends on it).

- [ ] **Step 1: Write the component**

Create `packages/ui/src/Button/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ');
  return <button className={classes} {...rest} />;
}
```

Create `packages/ui/src/Button/Button.module.css`:

```css
.button {
  font-family: var(--kd-font-display);
  font-size: 15px;
  border-radius: var(--kd-radius-sm);
  cursor: pointer;
  border: none;
  transition: opacity 0.15s ease;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.primary {
  padding: 14px 26px;
  background: var(--kd-accent-green);
  color: var(--kd-bg);
}

.secondary {
  padding: 12px 24px;
  background: transparent;
  border: 2px solid var(--kd-accent-cyan);
  color: var(--kd-text);
}

.danger {
  padding: 14px 26px;
  background: var(--kd-accent-pink);
  color: var(--kd-text);
}
```

- [ ] **Step 2: Export it from the barrel**

Append to `packages/ui/src/index.ts`:

```ts
export { Button } from './Button/Button';
export type { ButtonProps, ButtonVariant } from './Button/Button';
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kuhhandel/ui typecheck && pnpm --filter @kuhhandel/ui lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/Button packages/ui/src/index.ts
git commit -m "feat(ui): add Button component"
```

---

### Task 5: `RarityFrame` component

**Files:**
- Create: `packages/ui/src/RarityFrame/RarityFrame.tsx`
- Create: `packages/ui/src/RarityFrame/RarityFrame.module.css`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: tokens from Task 2, including `--kd-rarity-*`, `kd-holo-spin`,
  `--kd-holo-angle`, `--kd-accent-*`, `--kd-radius-sm`, `--kd-surface`.
- Produces:
  ```ts
  export const RARITIES: readonly ['commun','rare','epique','legendaire','mythique','secret','ultra-secret'];
  export type Rarity = typeof RARITIES[number];
  export interface RarityFrameProps {
    rarity: Rarity;
    size?: number; // default 52
    shape?: 'badge' | 'circle'; // default 'badge'
    children?: React.ReactNode;
  }
  export function RarityFrame(props: RarityFrameProps): JSX.Element;
  ```
  Task 6 (`PlayerAvatarBadge`) imports `RarityFrame`, `Rarity` and uses
  `shape="circle"`.

- [ ] **Step 1: Write the component**

Create `packages/ui/src/RarityFrame/RarityFrame.tsx`:

```tsx
import type { CSSProperties, ReactNode } from 'react';
import styles from './RarityFrame.module.css';

export const RARITIES = [
  'commun',
  'rare',
  'epique',
  'legendaire',
  'mythique',
  'secret',
  'ultra-secret',
] as const;
export type Rarity = (typeof RARITIES)[number];

const RARITY_COLOR_VAR: Record<Exclude<Rarity, 'ultra-secret'>, string> = {
  commun: 'var(--kd-rarity-commun)',
  rare: 'var(--kd-rarity-rare)',
  epique: 'var(--kd-rarity-epique)',
  legendaire: 'var(--kd-rarity-legendaire)',
  mythique: 'var(--kd-rarity-mythique)',
  secret: 'var(--kd-rarity-secret)',
};

const GLOW_RARITIES = new Set<Rarity>(['legendaire', 'mythique', 'secret', 'ultra-secret']);

export interface RarityFrameProps {
  rarity: Rarity;
  size?: number;
  shape?: 'badge' | 'circle';
  children?: ReactNode;
}

export function RarityFrame({ rarity, size = 52, shape = 'badge', children }: RarityFrameProps) {
  const isHolo = rarity === 'ultra-secret';
  const glow = GLOW_RARITIES.has(rarity);

  const style: CSSProperties & Record<string, string | number> = { width: size, height: size };
  if (!isHolo) {
    style['--rf-color'] = RARITY_COLOR_VAR[rarity];
  }

  const classes = [
    styles.frame,
    isHolo ? styles.holo : styles.solid,
    glow ? styles.glow : '',
    shape === 'circle' ? styles.circle : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}
```

Create `packages/ui/src/RarityFrame/RarityFrame.module.css`:

```css
.frame {
  border-radius: var(--kd-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  flex-shrink: 0;
}

.solid {
  background: var(--kd-surface);
  border: 3px solid var(--rf-color);
}

.glow.solid {
  box-shadow: 0 0 16px color-mix(in oklch, var(--rf-color) 55%, transparent);
}

.holo {
  border: 3px solid transparent;
  background:
    linear-gradient(var(--kd-surface), var(--kd-surface)) padding-box,
    conic-gradient(
        from var(--kd-holo-angle, 0deg),
        var(--kd-accent-green),
        var(--kd-accent-pink),
        var(--kd-accent-cyan),
        var(--kd-accent-yellow),
        var(--kd-accent-orange),
        var(--kd-accent-green)
      )
      border-box;
  animation: kd-holo-spin 3s linear infinite;
}

.glow.holo {
  box-shadow: 0 0 18px color-mix(in oklch, var(--kd-accent-pink) 60%, transparent);
}

.circle {
  border-radius: 50%;
}
```

The `.circle` rule is declared last so it wins the `border-radius` cascade
over `.frame` regardless of class order in the `className` string (both
have equal specificity — source order in the stylesheet decides).

- [ ] **Step 2: Export it from the barrel**

Append to `packages/ui/src/index.ts`:

```ts
export { RarityFrame, RARITIES } from './RarityFrame/RarityFrame';
export type { RarityFrameProps, Rarity } from './RarityFrame/RarityFrame';
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kuhhandel/ui typecheck && pnpm --filter @kuhhandel/ui lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/RarityFrame packages/ui/src/index.ts
git commit -m "feat(ui): add RarityFrame component (7 rarity tiers)"
```

---

### Task 6: `PlayerAvatarBadge` component

**Files:**
- Create: `packages/ui/src/PlayerAvatarBadge/PlayerAvatarBadge.tsx`
- Create: `packages/ui/src/PlayerAvatarBadge/PlayerAvatarBadge.module.css`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `RarityFrame`, `Rarity` from
  `../RarityFrame/RarityFrame` (Task 5); tokens `--kd-bg`,
  `--kd-accent-green`, `--kd-text-subtle`, `--kd-font-display`,
  `--kd-text-muted` from Task 2.
- Produces:
  ```ts
  export interface PlayerAvatarBadgeProps {
    name: string;
    imageSrc?: string;
    status?: 'online' | 'offline'; // default 'offline'
    rarity?: Rarity; // default 'commun'
    size?: number; // default 72
  }
  export function PlayerAvatarBadge(props: PlayerAvatarBadgeProps): JSX.Element;
  ```
  No later task depends on this one.

- [ ] **Step 1: Write the component**

Create `packages/ui/src/PlayerAvatarBadge/PlayerAvatarBadge.tsx`:

```tsx
import { RarityFrame, type Rarity } from '../RarityFrame/RarityFrame';
import styles from './PlayerAvatarBadge.module.css';

export interface PlayerAvatarBadgeProps {
  name: string;
  imageSrc?: string;
  status?: 'online' | 'offline';
  rarity?: Rarity;
  size?: number;
}

export function PlayerAvatarBadge({
  name,
  imageSrc,
  status = 'offline',
  rarity = 'commun',
  size = 72,
}: PlayerAvatarBadgeProps) {
  return (
    <div className={styles.wrapper} style={{ width: size, height: size }}>
      <RarityFrame rarity={rarity} size={size} shape="circle">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt={name} className={styles.image} />
        ) : (
          <span className={styles.initial}>{name.charAt(0).toUpperCase()}</span>
        )}
      </RarityFrame>
      <span
        className={[styles.status, status === 'online' ? styles.online : styles.offline].join(' ')}
      />
    </div>
  );
}
```

(The `eslint-disable` comment is a no-op safeguard — this project's
`eslint.config.mjs` doesn't currently include `@next/next` rules, but it's
harmless if that ever changes, since `packages/ui` is deliberately
framework-agnostic and shouldn't depend on `next/image`.)

Create `packages/ui/src/PlayerAvatarBadge/PlayerAvatarBadge.module.css`:

```css
.wrapper {
  position: relative;
  flex-shrink: 0;
}

.image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.initial {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--kd-font-display);
  font-size: 1.4em;
  color: var(--kd-text-muted);
}

.status {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 3px solid var(--kd-bg);
}

.online {
  background: var(--kd-accent-green);
}

.offline {
  background: var(--kd-text-subtle);
}
```

- [ ] **Step 2: Export it from the barrel**

Append to `packages/ui/src/index.ts`:

```ts
export { PlayerAvatarBadge } from './PlayerAvatarBadge/PlayerAvatarBadge';
export type { PlayerAvatarBadgeProps } from './PlayerAvatarBadge/PlayerAvatarBadge';
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kuhhandel/ui typecheck && pnpm --filter @kuhhandel/ui lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/PlayerAvatarBadge packages/ui/src/index.ts
git commit -m "feat(ui): add PlayerAvatarBadge component"
```

---

### Task 7: `PlayingCard` component

**Files:**
- Create: `packages/ui/src/PlayingCard/PlayingCard.tsx`
- Create: `packages/ui/src/PlayingCard/PlayingCard.module.css`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: tokens `--kd-radius-md`, `--kd-radius-sm`, `--kd-surface`,
  `--kd-surface-alt`, `--kd-bg`, `--kd-font-display`, `--kd-font-body`,
  `--kd-text-muted` from Task 2. Resolves images from
  `/cards/<imageSlot>.webp`, the paths produced by Task 3.
- Produces:
  ```ts
  export type PlayingCardVariant = 'animal' | 'money';
  export interface PlayingCardProps {
    variant: PlayingCardVariant;
    label: string;
    value: number;
    imageSlot: string; // e.g. 'animal-Cochon' or 'bill-50'
    accentColor: string; // a CSS color, e.g. 'var(--kd-accent-green)'
  }
  export function PlayingCard(props: PlayingCardProps): JSX.Element;
  ```
  No later task depends on this one directly (Task 11's style-guide page
  consumes it, but that's the terminal task).

- [ ] **Step 1: Write the component**

Create `packages/ui/src/PlayingCard/PlayingCard.tsx`:

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
}

export function PlayingCard({ variant, label, value, imageSlot, accentColor }: PlayingCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const style = { '--pc-accent': accentColor } as CSSProperties;

  return (
    <div className={styles.wrapper}>
      <div className={[styles.card, styles[variant]].join(' ')} style={style}>
        <div className={styles.art}>
          {imageFailed ? (
            <div className={styles.placeholder}>{label}</div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
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
      <div className={styles.caption}>{label}</div>
    </div>
  );
}
```

`"use client"` is required here (unlike the other primitives) because this
component uses `useState` for the image-load fallback.

Create `packages/ui/src/PlayingCard/PlayingCard.module.css`:

```css
.wrapper {
  width: 100%;
}

.card {
  position: relative;
  width: 100%;
  border-radius: var(--kd-radius-md);
  border: 3px solid var(--pc-accent);
  box-shadow: 0 0 16px color-mix(in oklch, var(--pc-accent) 55%, transparent);
  background: var(--kd-surface);
  overflow: hidden;
  box-sizing: border-box;
}

.animal {
  aspect-ratio: 5 / 7;
}

.money {
  aspect-ratio: 7 / 4;
  border-radius: var(--kd-radius-sm);
}

.art {
  position: absolute;
  inset: 8px;
  border-radius: calc(var(--kd-radius-md) - 6px);
  overflow: hidden;
}

.image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8px;
  box-sizing: border-box;
  background: repeating-linear-gradient(
    45deg,
    var(--kd-surface-alt) 0px,
    var(--kd-surface-alt) 10px,
    var(--kd-surface) 10px,
    var(--kd-surface) 20px
  );
  font-family: var(--kd-font-body);
  font-size: 12px;
  color: var(--kd-text-muted);
}

.value {
  position: absolute;
  top: 6px;
  left: 6px;
  background: color-mix(in oklch, var(--kd-bg) 85%, transparent);
  border-radius: 8px;
  padding: 2px 8px;
  font-family: var(--kd-font-display);
  font-size: 16px;
  color: var(--pc-accent);
}

.caption {
  text-align: center;
  font-family: var(--kd-font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--kd-text-muted);
  margin-top: 8px;
}
```

- [ ] **Step 2: Export it from the barrel**

Append to `packages/ui/src/index.ts`:

```ts
export { PlayingCard } from './PlayingCard/PlayingCard';
export type { PlayingCardProps, PlayingCardVariant } from './PlayingCard/PlayingCard';
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kuhhandel/ui typecheck && pnpm --filter @kuhhandel/ui lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/PlayingCard packages/ui/src/index.ts
git commit -m "feat(ui): add PlayingCard component"
```

---

### Task 8: `ToastNarrator` component

**Files:**
- Create: `packages/ui/src/ToastNarrator/ToastNarrator.tsx`
- Create: `packages/ui/src/ToastNarrator/ToastNarrator.module.css`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `NarratorStyle` type from `@kuhhandel/shared-types` (literal
  union `"sport" | "documentary" | "western" | "tv"`, defined in
  `packages/narrator-engine/src/types.ts:6-7` and re-exported from
  `packages/shared-types/src/index.ts`); tokens `--kd-surface-alt`,
  `--kd-radius-md`, `--kd-font-display`, `--kd-font-body`, `--kd-text`,
  `--kd-accent-green/cyan/orange/pink` from Task 2.
- Produces:
  ```ts
  export interface ToastNarratorProps {
    narratorStyle: NarratorStyle;
    message: string;
  }
  export function ToastNarrator(props: ToastNarratorProps): JSX.Element;
  ```
  No later task depends on this one directly.

- [ ] **Step 1: Write the component**

Create `packages/ui/src/ToastNarrator/ToastNarrator.tsx`:

```tsx
import type { CSSProperties } from 'react';
import type { NarratorStyle } from '@kuhhandel/shared-types';
import styles from './ToastNarrator.module.css';

const NARRATOR_LABEL: Record<NarratorStyle, string> = {
  sport: 'Commentateur sportif',
  documentary: 'Documentaire animalier',
  western: 'Western',
  tv: 'Présentateur télé',
};

const NARRATOR_COLOR_VAR: Record<NarratorStyle, string> = {
  sport: 'var(--kd-accent-green)',
  documentary: 'var(--kd-accent-cyan)',
  western: 'var(--kd-accent-orange)',
  tv: 'var(--kd-accent-pink)',
};

export interface ToastNarratorProps {
  narratorStyle: NarratorStyle;
  message: string;
}

export function ToastNarrator({ narratorStyle, message }: ToastNarratorProps) {
  const style = { '--tn-color': NARRATOR_COLOR_VAR[narratorStyle] } as CSSProperties;
  return (
    <div className={styles.toast} style={style}>
      <div className={styles.label}>{NARRATOR_LABEL[narratorStyle]}</div>
      <div className={styles.message}>{message}</div>
      <div className={styles.tail} />
    </div>
  );
}
```

Create `packages/ui/src/ToastNarrator/ToastNarrator.module.css`:

```css
.toast {
  position: relative;
  max-width: 320px;
  background: var(--kd-surface-alt);
  border: 2px solid var(--tn-color);
  border-radius: var(--kd-radius-md);
  padding: 16px 18px;
}

.label {
  font-family: var(--kd-font-display);
  font-size: 11px;
  color: var(--tn-color);
  margin-bottom: 6px;
  text-transform: uppercase;
}

.message {
  font-family: var(--kd-font-body);
  font-size: 14px;
  font-weight: 600;
  color: var(--kd-text);
}

.tail {
  position: absolute;
  bottom: -10px;
  left: 24px;
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid var(--tn-color);
}
```

- [ ] **Step 2: Export it from the barrel**

Append to `packages/ui/src/index.ts`:

```ts
export { ToastNarrator } from './ToastNarrator/ToastNarrator';
export type { ToastNarratorProps } from './ToastNarrator/ToastNarrator';
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kuhhandel/ui typecheck && pnpm --filter @kuhhandel/ui lint`
Expected: both pass — this also confirms `@kuhhandel/shared-types` resolves
correctly as a dependency of `packages/ui` (added in Task 1).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/ToastNarrator packages/ui/src/index.ts
git commit -m "feat(ui): add ToastNarrator component"
```

---

### Task 9: `Input` and `Select` components

**Files:**
- Create: `packages/ui/src/FormField/FormField.module.css`
- Create: `packages/ui/src/FormField/Input.tsx`
- Create: `packages/ui/src/FormField/Select.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: tokens `--kd-font-body`, `--kd-text`, `--kd-surface`,
  `--kd-border`, `--kd-radius-sm`, `--kd-accent-cyan` from Task 2.
- Produces:
  ```ts
  export function Input(props: InputHTMLAttributes<HTMLInputElement>): JSX.Element;
  export function Select(props: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element;
  ```
  No later task depends on these directly.

- [ ] **Step 1: Write the shared field styling**

Create `packages/ui/src/FormField/FormField.module.css`:

```css
.field {
  font-family: var(--kd-font-body);
  font-size: 14px;
  color: var(--kd-text);
  background: var(--kd-surface);
  border: 1px solid var(--kd-border);
  border-radius: var(--kd-radius-sm);
  padding: 10px 14px;
}

.field:focus {
  outline: none;
  border-color: var(--kd-accent-cyan);
}
```

- [ ] **Step 2: Write the components**

Create `packages/ui/src/FormField/Input.tsx`:

```tsx
import type { InputHTMLAttributes } from 'react';
import styles from './FormField.module.css';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={[styles.field, className].filter(Boolean).join(' ')} {...rest} />;
}
```

Create `packages/ui/src/FormField/Select.tsx`:

```tsx
import type { SelectHTMLAttributes } from 'react';
import styles from './FormField.module.css';

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={[styles.field, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </select>
  );
}
```

- [ ] **Step 3: Export them from the barrel**

Append to `packages/ui/src/index.ts`:

```ts
export { Input } from './FormField/Input';
export { Select } from './FormField/Select';
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @kuhhandel/ui typecheck && pnpm --filter @kuhhandel/ui lint`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/FormField packages/ui/src/index.ts
git commit -m "feat(ui): add Input and Select components"
```

---

### Task 10: `InfoStatusIcon` component

**Files:**
- Create: `packages/ui/src/InfoStatusIcon/InfoStatusIcon.tsx`
- Create: `packages/ui/src/InfoStatusIcon/InfoStatusIcon.module.css`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: tokens `--kd-accent-green`, `--kd-accent-yellow` from Task 2.
- Produces:
  ```ts
  export type InfoStatus = 'known' | 'partial';
  export interface InfoStatusIconProps {
    status: InfoStatus;
    label: string; // accessible label, e.g. "Connu avec certitude"
  }
  export function InfoStatusIcon(props: InfoStatusIconProps): JSX.Element;
  ```
  Replaces the current `✅`/`🔒` literals used in
  `apps/web/components/KuhhandelPanel.tsx` and `GameTable.tsx` — wiring
  those call sites is deferred to the screen-level phase that touches those
  files, this task only builds the primitive.

- [ ] **Step 1: Write the component**

Create `packages/ui/src/InfoStatusIcon/InfoStatusIcon.tsx`:

```tsx
import styles from './InfoStatusIcon.module.css';

export type InfoStatus = 'known' | 'partial';

export interface InfoStatusIconProps {
  status: InfoStatus;
  label: string;
}

export function InfoStatusIcon({ status, label }: InfoStatusIconProps) {
  return (
    <span
      className={[styles.icon, styles[status]].join(' ')}
      role="img"
      aria-label={label}
      title={label}
    />
  );
}
```

Create `packages/ui/src/InfoStatusIcon/InfoStatusIcon.module.css`:

```css
.icon {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  vertical-align: middle;
  box-sizing: border-box;
}

.known {
  background: var(--kd-accent-green);
  box-shadow: 0 0 8px color-mix(in oklch, var(--kd-accent-green) 55%, transparent);
}

.partial {
  background: transparent;
  border: 2px solid var(--kd-accent-yellow);
}
```

`known` (known with certainty) renders as a solid glowing green dot;
`partial` (partially known) renders as a hollow yellow-outlined dot — shape
+ accent color carry the meaning instead of an emoji.

- [ ] **Step 2: Export it from the barrel**

Append to `packages/ui/src/index.ts`:

```ts
export { InfoStatusIcon } from './InfoStatusIcon/InfoStatusIcon';
export type { InfoStatus, InfoStatusIconProps } from './InfoStatusIcon/InfoStatusIcon';
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kuhhandel/ui typecheck && pnpm --filter @kuhhandel/ui lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/InfoStatusIcon packages/ui/src/index.ts
git commit -m "feat(ui): add InfoStatusIcon component"
```

---

### Task 11: Wire `@kuhhandel/ui` into the web app + style guide route

**Files:**
- Modify: `apps/web/next.config.ts`
- Create: `apps/web/app/style-guide/page.tsx`

**Interfaces:**
- Consumes: every export from `@kuhhandel/ui` produced by Tasks 4-10
  (`Button`, `PlayingCard`, `RarityFrame`+`RARITIES`, `PlayerAvatarBadge`,
  `ToastNarrator`, `Input`, `Select`, `InfoStatusIcon`), the `NarratorStyle`
  type from `@kuhhandel/shared-types`, and the 16 static assets from Task 3.
- Produces: a working `/style-guide` route for manual visual QA. Terminal
  task — nothing depends on it.

- [ ] **Step 1: Enable transpilation of `@kuhhandel/ui`**

Next.js only runs its compiler (needed for `.module.css` extraction) over
workspace packages listed in `transpilePackages` — without this, importing
`PlayingCard.module.css` etc. from `apps/web` fails to build. Replace
`apps/web/next.config.ts` with:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@kuhhandel/ui'],
};

export default nextConfig;
```

- [ ] **Step 2: Write the style guide route**

Create `apps/web/app/style-guide/page.tsx`:

```tsx
import {
  Button,
  InfoStatusIcon,
  Input,
  PlayerAvatarBadge,
  PlayingCard,
  RARITIES,
  RarityFrame,
  Select,
  ToastNarrator,
} from '@kuhhandel/ui';
import type { NarratorStyle } from '@kuhhandel/shared-types';

const ANIMAL_ACCENTS = [
  'var(--kd-accent-green)',
  'var(--kd-accent-pink)',
  'var(--kd-accent-cyan)',
  'var(--kd-accent-yellow)',
  'var(--kd-accent-orange)',
];

// Real species + values from packages/game-engine/src/config/species.config.ts
// (not the design handoff's example numbers). "boeuf" has no artwork in the
// handoff (it shipped an unused "animal-Poule" illustration instead) —
// imageSlot: null deliberately exercises PlayingCard's placeholder fallback.
const ANIMALS: Array<{ species: string; slot: string | null; label: string; value: number }> = [
  { species: 'cochon', slot: 'animal-Cochon', label: 'Cochon', value: 100 },
  { species: 'oie', slot: 'animal-Oie', label: 'Oie', value: 200 },
  { species: 'mouton', slot: 'animal-Mouton', label: 'Mouton', value: 300 },
  { species: 'chevre', slot: 'animal-Chèvre', label: 'Chèvre', value: 400 },
  { species: 'ane', slot: 'animal-Âne', label: 'Âne', value: 500 },
  { species: 'chien', slot: 'animal-Chien', label: 'Chien', value: 650 },
  { species: 'chat', slot: 'animal-Chat', label: 'Chat', value: 800 },
  { species: 'cheval', slot: 'animal-Cheval', label: 'Cheval', value: 1000 },
  { species: 'boeuf', slot: null, label: 'Bœuf', value: 1200 },
  { species: 'vache', slot: 'animal-Vache', label: 'Vache', value: 1500 },
];

// Real denominations from packages/game-engine/src/config/money.config.ts
const BILLS = [0, 10, 50, 100, 200, 500];

const NARRATOR_STYLES: NarratorStyle[] = ['sport', 'documentary', 'western', 'tv'];

export default function StyleGuidePage() {
  return (
    <main style={{ padding: 48, display: 'flex', flexDirection: 'column', gap: 48 }}>
      <section>
        <h2>Boutons</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button variant="primary">Enchérir</Button>
          <Button variant="secondary">Passer</Button>
          <Button variant="danger">Vendre !</Button>
        </div>
      </section>

      <section>
        <h2>Cartes animaux</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 18,
          }}
        >
          {ANIMALS.map((a, i) => (
            <PlayingCard
              key={a.species}
              variant="animal"
              label={a.label}
              value={a.value}
              imageSlot={a.slot ?? 'animal-missing'}
              accentColor={ANIMAL_ACCENTS[i % ANIMAL_ACCENTS.length] as string}
            />
          ))}
        </div>
      </section>

      <section>
        <h2>Billets</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 18,
          }}
        >
          {BILLS.map((value) => (
            <PlayingCard
              key={value}
              variant="money"
              label={`Billet ${value}`}
              value={value}
              imageSlot={`bill-${value}`}
              accentColor="var(--kd-accent-orange)"
            />
          ))}
        </div>
      </section>

      <section>
        <h2>Rareté</h2>
        <div style={{ display: 'flex', gap: 14 }}>
          {RARITIES.map((r) => (
            <RarityFrame key={r} rarity={r} />
          ))}
        </div>
      </section>

      <section>
        <h2>Avatars joueur</h2>
        <div style={{ display: 'flex', gap: 20 }}>
          <PlayerAvatarBadge name="Jonathan" status="online" rarity="epique" />
          <PlayerAvatarBadge name="Alex" status="offline" />
        </div>
      </section>

      <section>
        <h2>Narrateur</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {NARRATOR_STYLES.map((style) => (
            <ToastNarrator
              key={style}
              narratorStyle={style}
              message="Et c'est une offre historique !"
            />
          ))}
        </div>
      </section>

      <section>
        <h2>Champs</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <Input placeholder="Pseudo" />
          <Select defaultValue="sport">
            <option value="sport">Commentateur sportif</option>
            <option value="documentary">Documentaire animalier</option>
          </Select>
        </div>
      </section>

      <section>
        <h2>Indicateurs d&apos;information</h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <InfoStatusIcon status="known" label="Connu avec certitude" />
          <InfoStatusIcon status="partial" label="Partiellement connu" />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Verify with the dev server (manual visual check)**

Run: `pnpm --filter @kuhhandel/web dev`, open
`http://localhost:3000/style-guide`.

Expected, checked against `~/Downloads/design_handoff_kuchendal/Kuchendal
Direction Artistique.dc.html` and the README token values:
- Dark near-black background throughout, Bungee headings/buttons, Space
  Grotesk body text.
- 3 button variants render with correct fills/borders.
- All 9 animal cards with real artwork show illustrations; the "Bœuf" card
  shows the striped placeholder pattern with its label (proving the
  fallback works). All 6 bill cards show real artwork.
- 7 rarity frames render distinct borders; the last one (Ultra-secret)
  visibly animates a spinning rainbow border.
- Avatar badges show the initial-letter fallback, correct online/offline
  dot color, and a rarity ring.
- 4 narrator toasts render in 4 distinct colors with correct French labels.
- Input and Select are styled (dark surface, neutral border, cyan on
  focus).
- The two info-status dots are visually distinct (filled glow vs. hollow
  ring).

Stop the dev server after checking.

Run: `pnpm --filter @kuhhandel/web typecheck && pnpm --filter @kuhhandel/web lint`
Expected: both pass.

Run: `pnpm --filter @kuhhandel/web build`
Expected: production build succeeds (confirms `transpilePackages` and the
CSS Module pipeline work end-to-end, not just in dev mode).

- [ ] **Step 4: Tick the delivered boxes in `docs/DESIGN_ASSETS.md`**

In `docs/DESIGN_ASSETS.md`, check off:
- All of §0 (palette, typography, tone reference is the handoff itself,
  logo/favicon remain unchecked — not built this phase)
- The 10 animal illustrations and card back item in §1 that now have real
  artwork (leave "dos de carte animal" and the 2 remaining visual states
  unchecked — not built this phase)
- All 6 money bills in §2 (leave "dos de carte argent" unchecked)
- The primitives built this phase in §3: `PlayerAvatarBadge`,
  `ToastNarrator`, buttons/inputs/selects base style, and the info-status
  icons line (leave `BidTicker`, `SecretOfferTray`, `RewardModal`,
  `HallOfShameCard` unchecked — screen-level components, later phase)

- [ ] **Step 5: Commit**

```bash
git add apps/web/next.config.ts apps/web/app/style-guide docs/DESIGN_ASSETS.md
git commit -m "feat(web): wire up @kuhhandel/ui and add a /style-guide QA route"
```
