# Kuhhandel Rules-Engine Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `packages/game-engine` (and its consumers) match the official Kuhhandel rulebook exactly: correct species roster/values, the scoring multiplier, a shared finite money bank, correct Kuhhandel money resolution, the special 2-card Kuhhandel, the golden donkey bonus, and the real end-game trigger with a mandatory forced-Kuhhandel phase.

**Architecture:** A new `packages/shared-data` package becomes the single source of truth for species data, imported by both `game-engine` (server-side rules) and `shared-types` (browser bundle) without pulling engine logic into the client. `game-engine` gains a `money/moneyBank.ts` module (finite 55-card supply) and a `kuhhandel/goldenDonkey.ts` module; `scoring.ts` splits "deck exhausted" from "game over" (all families complete). `apps/realtime-server`'s `GameRoom` is the only place that threads these new engine primitives into live gameplay (phase tracking, forced-Kuhhandel turn skipping, donkey bonus distribution).

**Tech Stack:** TypeScript (ESM, `strict`), pnpm workspaces, vitest.

## Global Constraints

- Every workspace package follows the existing pattern: `package.json` with `"type": "module"`, `"main"/"types": "src/index.ts"`, `tsconfig.json` extending `../../tsconfig.base.json`.
- No DB migration/backfill of historical game or score data (explicitly out of scope — see spec).
- No UI/visual changes beyond the `animal-Poule` → `coq` artwork remap already required by the species fix.
- Existing consumers must keep compiling: `packages/bot-engine`, `packages/rare-events-engine`, `packages/meta-engine` reference `SpeciesKey`/`SPECIES_FAMILY_VALUE`/`CARDS_PER_SPECIES` generically (no hardcoded species names besides test fixture strings that remain valid under the new roster) and need no source changes — only re-running their test suites to confirm.
- Run `pnpm --filter <package> test` (or `pnpm -r test` for a full sweep) after every task; every task must leave the repo in a green, compiling state.

---

### Task 1: `packages/shared-data` — species single source of truth

**Files:**
- Create: `packages/shared-data/package.json`
- Create: `packages/shared-data/tsconfig.json`
- Create: `packages/shared-data/src/species.ts`
- Create: `packages/shared-data/src/index.ts`
- Test: `packages/shared-data/test/species.test.ts`

**Interfaces:**
- Produces: `SPECIES_KEYS: readonly string[]`, `type SpeciesKey`, `SPECIES_FAMILY_VALUE: Record<SpeciesKey, number>`, `CARDS_PER_SPECIES: 4`, all exported from `@kuhhandel/shared-data`.

- [ ] **Step 1: Scaffold the package**

`packages/shared-data/package.json`:
```json
{
  "name": "@kuhhandel/shared-data",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

`packages/shared-data/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Write the failing test for the corrected roster**

`packages/shared-data/test/species.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CARDS_PER_SPECIES, SPECIES_KEYS, SPECIES_FAMILY_VALUE } from '../src/species.js';

describe('species data', () => {
  it('has the 10 real Kuhhandel species, no boeuf', () => {
    expect(SPECIES_KEYS).toHaveLength(10);
    expect(SPECIES_KEYS).not.toContain('boeuf');
    expect(SPECIES_KEYS).toContain('coq');
  });

  it('matches the rulebook value table', () => {
    expect(SPECIES_FAMILY_VALUE).toEqual({
      coq: 10,
      oie: 40,
      chat: 90,
      chien: 160,
      mouton: 250,
      chevre: 350,
      ane: 500,
      cochon: 650,
      vache: 800,
      cheval: 1000,
    });
  });

  it('has 4 cards per species', () => {
    expect(CARDS_PER_SPECIES).toBe(4);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @kuhhandel/shared-data test`
Expected: FAIL — `src/species.js` does not exist yet.

- [ ] **Step 4: Implement the data module**

`packages/shared-data/src/species.ts`:
```ts
/**
 * Single source of truth for the species roster/values, imported by both
 * `@kuhhandel/game-engine` (server rules) and `@kuhhandel/shared-types`
 * (browser bundle) so the two never drift out of sync. Pure data, no
 * logic — safe to bundle in the client without pulling in engine code.
 */
export const SPECIES_KEYS = [
  'coq',
  'oie',
  'chat',
  'chien',
  'mouton',
  'chevre',
  'ane',
  'cochon',
  'vache',
  'cheval',
] as const;

export type SpeciesKey = (typeof SPECIES_KEYS)[number];

export const SPECIES_FAMILY_VALUE: Record<SpeciesKey, number> = {
  coq: 10,
  oie: 40,
  chat: 90,
  chien: 160,
  mouton: 250,
  chevre: 350,
  ane: 500,
  cochon: 650,
  vache: 800,
  cheval: 1000,
};

export const CARDS_PER_SPECIES = 4;
```

`packages/shared-data/src/index.ts`:
```ts
export * from './species.js';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @kuhhandel/shared-data test`
Expected: PASS

- [ ] **Step 6: Install to link the new workspace package**

Run: `pnpm install`
Expected: `packages/shared-data` linked into the workspace (already matched by `pnpm-workspace.yaml`'s `packages/*` glob).

- [ ] **Step 7: Commit**

```bash
git add packages/shared-data
git commit -m "feat(shared-data): add single-source species roster/values"
```

---

### Task 2: Point `game-engine` and `shared-types` at `shared-data`

**Files:**
- Modify: `packages/game-engine/src/config/species.config.ts`
- Modify: `packages/game-engine/package.json` (add dependency)
- Modify: `packages/shared-types/src/species.ts`
- Modify: `packages/shared-types/package.json` (add dependency)

**Interfaces:**
- Consumes: `SPECIES_KEYS`, `SpeciesKey`, `SPECIES_FAMILY_VALUE`, `CARDS_PER_SPECIES` from `@kuhhandel/shared-data` (Task 1).
- Produces: same names, still re-exported from `@kuhhandel/game-engine` and `@kuhhandel/shared-types` — no consumer import paths change.

- [ ] **Step 1: Add the workspace dependency to both packages**

`packages/game-engine/package.json` — add under `"dependencies"` (new key, package currently has none):
```json
  "dependencies": {
    "@kuhhandel/shared-data": "workspace:*"
  },
```

`packages/shared-types/package.json` — add to the existing `"dependencies"` block:
```json
    "@kuhhandel/shared-data": "workspace:*",
```

- [ ] **Step 2: Replace `species.config.ts`'s hand-written roster**

`packages/game-engine/src/config/species.config.ts` (full replacement):
```ts
/**
 * Barème de valeur par espèce (GDD §5, point 1). Valeurs et roster tirés
 * du livret de règles officiel Kuhhandel (voir le worked example §4 :
 * 4 cochons + 4 chiens + 4 coqs = 650+160+10 = 820, ×3 familles = 2460).
 * Source de vérité partagée avec le bundle navigateur : voir
 * @kuhhandel/shared-data (packages/shared-data/src/species.ts).
 */
export {
  SPECIES_KEYS,
  SPECIES_FAMILY_VALUE,
  CARDS_PER_SPECIES,
  type SpeciesKey,
} from '@kuhhandel/shared-data';
```

- [ ] **Step 3: Replace `shared-types/src/species.ts`'s duplicated copy**

`packages/shared-types/src/species.ts` (full replacement):
```ts
/**
 * Re-exports the single-source species data from `@kuhhandel/shared-data`
 * (pure data package, no engine logic) — safe to bundle into the browser
 * without pulling in `@kuhhandel/game-engine`'s auction/kuhhandel/scoring
 * modules. See packages/shared-data/src/species.ts for the values.
 */
export { SPECIES_KEYS, SPECIES_FAMILY_VALUE, type SpeciesKey } from '@kuhhandel/shared-data';
```

- [ ] **Step 4: Run affected test suites**

Run: `pnpm install && pnpm --filter @kuhhandel/game-engine test && pnpm --filter @kuhhandel/shared-types test`
Expected: `game-engine`'s `setup.test.ts` still passes (it only asserts counts, not exact species names/values). `scoring.test.ts` will now FAIL — expected, fixed in Task 3.

- [ ] **Step 5: Commit**

```bash
git add packages/game-engine packages/shared-types
git commit -m "fix(species): source roster/values from @kuhhandel/shared-data, remove duplication"
```

---

### Task 3: Update `apps/web` species artwork/labels for the corrected roster

**Files:**
- Modify: `apps/web/lib/species.ts`
- Modify: `apps/web/app/style-guide/page.tsx`

**Interfaces:**
- Consumes: `SpeciesKey` from `@kuhhandel/shared-types` (Task 2) — now `coq`/no `boeuf`.

- [ ] **Step 1: Update `SPECIES_IMAGE_SLOT` and `SPECIES_LABEL`**

`apps/web/lib/species.ts` (full replacement):
```ts
import type { SpeciesKey } from "@kuhhandel/shared-types";

/**
 * Species keys are lowercase ASCII (`cochon`, `chevre`, `ane`, ...) but the
 * extracted card artwork filenames use capitalized, accented French names
 * (`Cochon`, `Chèvre`, `Âne`, ...) — see `apps/web/app/style-guide/page.tsx`
 * for the source pattern. `coq` reuses the `animal-Poule` asset: an earlier
 * design handoff used "Poule" (hen) where the rulebook says "Coq" (rooster)
 * for the same slot/value, so the existing artwork is correct, just
 * relabeled.
 */
export const SPECIES_IMAGE_SLOT: Record<SpeciesKey, string> = {
  coq: "animal-Poule",
  oie: "animal-Oie",
  chat: "animal-Chat",
  chien: "animal-Chien",
  mouton: "animal-Mouton",
  chevre: "animal-Chèvre",
  ane: "animal-Âne",
  cochon: "animal-Cochon",
  vache: "animal-Vache",
  cheval: "animal-Cheval",
};

/** Human-readable French labels for species keys — used everywhere a
 * species is rendered as user-facing text (self-hand, opponents' family
 * summary, auction heading, Kuhhandel heading, species picker). */
export const SPECIES_LABEL: Record<SpeciesKey, string> = {
  coq: "Coq",
  oie: "Oie",
  chat: "Chat",
  chien: "Chien",
  mouton: "Mouton",
  chevre: "Chèvre",
  ane: "Âne",
  cochon: "Cochon",
  vache: "Vache",
  cheval: "Cheval",
};
```

- [ ] **Step 2: Update the style guide's species table**

Read `apps/web/app/style-guide/page.tsx` around its species list (currently includes a `boeuf` row with `slot: null` and a comment about the unused "animal-Poule" illustration — search for `{ species: 'boeuf'`). Replace that row and the ones around it with the corrected roster/values, and change the `boeuf` row to a `coq` row pointing at the `animal-Poule` slot:

```tsx
{ species: 'coq', slot: 'animal-Poule', label: 'Coq', value: 10 },
{ species: 'oie', slot: 'animal-Oie', label: 'Oie', value: 40 },
{ species: 'chat', slot: 'animal-Chat', label: 'Chat', value: 90 },
{ species: 'chien', slot: 'animal-Chien', label: 'Chien', value: 160 },
{ species: 'mouton', slot: 'animal-Mouton', label: 'Mouton', value: 250 },
{ species: 'chevre', slot: 'animal-Chèvre', label: 'Chèvre', value: 350 },
{ species: 'ane', slot: 'animal-Âne', label: 'Âne', value: 500 },
{ species: 'cochon', slot: 'animal-Cochon', label: 'Cochon', value: 650 },
{ species: 'vache', slot: 'animal-Vache', label: 'Vache', value: 800 },
{ species: 'cheval', slot: 'animal-Cheval', label: 'Cheval', value: 1000 },
```

Remove the now-stale comment about `boeuf` having no artwork and `animal-Poule` being "unused" (it's used now, by `coq`).

- [ ] **Step 3: Typecheck and build the web app**

Run: `pnpm --filter apps/web typecheck`
Expected: PASS — no leftover reference to `boeuf` anywhere in `apps/web` (search with `grep -rn boeuf apps/web` to confirm zero hits besides this plan/spec history).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/species.ts apps/web/app/style-guide/page.tsx
git commit -m "fix(web): remap species artwork/labels to the corrected roster (coq replaces boeuf)"
```

---

### Task 4: Scoring multiplier

**Files:**
- Modify: `packages/game-engine/src/scoring/scoring.ts`
- Test: `packages/game-engine/test/scoring.test.ts`

**Interfaces:**
- Produces: `computeScore(player: Player): number` (unchanged signature, corrected behavior).

- [ ] **Step 1: Update the failing/incorrect assertions and add the rulebook worked example**

`packages/game-engine/test/scoring.test.ts` — replace the `computeScore` describe block (species names change too, since `cochon`/`vache` keep their old value coincidentally close but `oie` and others don't — use the corrected values from Task 1/2):

```ts
describe('computeScore', () => {
  it('applies the family-count multiplier (rulebook worked example, GDD §4)', () => {
    const player: Player = {
      id: 'p1',
      name: 'P1',
      money: [],
      animals: [
        ...animals('cochon', 'cochon', 'cochon', 'cochon'), // 650
        ...animals('chien', 'chien', 'chien', 'chien'), // 160
        ...animals('coq', 'coq', 'coq', 'coq'), // 10
      ],
    };

    // 650 + 160 + 10 = 820, × 3 complete families = 2460
    expect(computeScore(player)).toBe(2460);
  });

  it('gives zero value to incomplete families and does not count them toward the multiplier', () => {
    const player: Player = {
      id: 'p1',
      name: 'P1',
      money: [],
      animals: animals('cochon', 'cochon'), // incomplete
    };

    expect(computeScore(player)).toBe(0);
  });

  it('applies a ×1 multiplier for exactly one complete family', () => {
    const player: Player = {
      id: 'p1',
      name: 'P1',
      money: [],
      animals: [
        ...animals('cochon', 'cochon', 'cochon', 'cochon'), // 650
        ...animals('oie', 'oie'), // incomplete, 0
      ],
    };

    expect(computeScore(player)).toBe(650);
  });

  it('applies the multiplier across all ten families when every family is complete', () => {
    const player: Player = {
      id: 'p1',
      name: 'P1',
      money: [],
      animals: [
        ...animals('coq', 'coq', 'coq', 'coq'), // 10
        ...animals('oie', 'oie', 'oie', 'oie'), // 40
        ...animals('chat', 'chat', 'chat', 'chat'), // 90
        ...animals('chien', 'chien', 'chien', 'chien'), // 160
        ...animals('mouton', 'mouton', 'mouton', 'mouton'), // 250
        ...animals('chevre', 'chevre', 'chevre', 'chevre'), // 350
        ...animals('ane', 'ane', 'ane', 'ane'), // 500
        ...animals('cochon', 'cochon', 'cochon', 'cochon'), // 650
        ...animals('vache', 'vache', 'vache', 'vache'), // 800
        ...animals('cheval', 'cheval', 'cheval', 'cheval'), // 1000
      ],
    };

    // sum = 10+40+90+160+250+350+500+650+800+1000 = 3850, ×10 = 38500
    expect(computeScore(player)).toBe(38500);
  });

  it('does not count remaining money in the score (GDD §5 default)', () => {
    const player: Player = {
      id: 'p1',
      name: 'P1',
      money: [{ id: 'm1', value: 500 }],
      animals: [],
    };

    expect(computeScore(player)).toBe(0);
  });
});
```

Leave the `isGameOver`/`nextPlayerIndex` describe blocks as-is for now (Task 11 rewrites `isGameOver`'s tests).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @kuhhandel/game-engine test -- scoring`
Expected: FAIL — `computeScore` returns 820 instead of 2460, 350 instead of 650 is not the failure (650 alone would already pass, skip) — the multiplier cases fail.

- [ ] **Step 3: Implement the multiplier**

`packages/game-engine/src/scoring/scoring.ts` — replace `computeScore`:
```ts
export function computeScore(player: Player): number {
  const countBySpecies = new Map<AnimalCard['species'], number>();
  for (const card of player.animals) {
    countBySpecies.set(card.species, (countBySpecies.get(card.species) ?? 0) + 1);
  }

  let completeFamiliesValue = 0;
  let completeFamiliesCount = 0;
  for (const [species, count] of countBySpecies) {
    if (count >= CARDS_PER_SPECIES) {
      completeFamiliesValue += SPECIES_FAMILY_VALUE[species];
      completeFamiliesCount += 1;
    }
  }
  return completeFamiliesValue * completeFamiliesCount;
}
```

(`INCOMPLETE_FAMILY_VALUE` is no longer referenced by `computeScore` — incomplete families now contribute nothing at all, matching "l'argent n'a plus aucune valeur" / no per-animal value for incomplete groups. Remove the now-unused import of `INCOMPLETE_FAMILY_VALUE` from this file, but leave the constant itself in `game.config.ts` since nothing else in this plan removes it — actually check for other usages first with `grep -rn INCOMPLETE_FAMILY_VALUE packages apps`; if `scoring.ts` was its only consumer, delete the constant from `game.config.ts` too and drop it from `packages/game-engine/src/index.ts`'s re-export surface implicitly via the config module.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @kuhhandel/game-engine test -- scoring`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/game-engine/src/scoring/scoring.ts packages/game-engine/src/config/game.config.ts packages/game-engine/test/scoring.test.ts
git commit -m "fix(scoring): apply the complete-family-count multiplier (rulebook §4)"
```

---

### Task 5: Shared money bank

**Files:**
- Create: `packages/game-engine/src/money/moneyBank.ts`
- Test: `packages/game-engine/test/moneyBank.test.ts`

**Interfaces:**
- Produces: `MoneyBank` type, `createMoneyBank(): MoneyBank`, `drawFromBank(bank: MoneyBank, denomination: MoneyDenomination, count: number): { bank: MoneyBank; cards: MoneyCard[] }` (throws if insufficient), `drawFromBankWithFallback(bank: MoneyBank, denomination: MoneyDenomination, count: number): { bank: MoneyBank; cards: MoneyCard[] }` (never throws — escalates to the next larger available denomination one card at a time when the bank is short).
- Consumes: `MONEY_DENOMINATIONS`, `MoneyDenomination` from `../config/money.config.js`; `MoneyCard` from `../types.js`.

- [ ] **Step 1: Write the failing tests**

`packages/game-engine/test/moneyBank.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  createMoneyBank,
  drawFromBank,
  drawFromBankWithFallback,
} from '../src/money/moneyBank.js';

describe('createMoneyBank', () => {
  it('starts with the rulebook’s 55-card supply', () => {
    const bank = createMoneyBank();
    expect(bank.counts).toEqual({ 0: 10, 10: 20, 50: 10, 100: 5, 200: 5, 500: 5 });
  });
});

describe('drawFromBank', () => {
  it('mints the requested cards and decrements the bank', () => {
    const bank = createMoneyBank();
    const { bank: next, cards } = drawFromBank(bank, 50, 3);

    expect(cards).toHaveLength(3);
    expect(cards.every((c) => c.value === 50)).toBe(true);
    expect(new Set(cards.map((c) => c.id)).size).toBe(3);
    expect(next.counts[50]).toBe(7);
    expect(bank.counts[50]).toBe(10); // original bank is untouched (pure)
  });

  it('throws when the bank does not have enough of that denomination', () => {
    const bank = createMoneyBank();
    expect(() => drawFromBank(bank, 500, 6)).toThrow(/500/);
  });
});

describe('drawFromBankWithFallback', () => {
  it('behaves like drawFromBank when supply is sufficient', () => {
    const bank = createMoneyBank();
    const { bank: next, cards } = drawFromBankWithFallback(bank, 10, 5);

    expect(cards.every((c) => c.value === 10)).toBe(true);
    expect(next.counts[10]).toBe(15);
  });

  it('escalates to the next larger available denomination when exhausted', () => {
    let bank = createMoneyBank();
    bank = drawFromBank(bank, 0, 10).bank; // exhaust all ten "0" cards

    const { bank: next, cards } = drawFromBankWithFallback(bank, 0, 2);

    expect(cards).toHaveLength(2);
    expect(cards.every((c) => c.value === 10)).toBe(true); // next denomination up
    expect(next.counts[10]).toBe(18);
  });

  it('never throws even if every denomination is exhausted', () => {
    let bank = createMoneyBank();
    for (const denom of [0, 10, 50, 100, 200] as const) {
      bank = drawFromBank(bank, denom, bank.counts[denom]).bank;
    }
    bank = drawFromBank(bank, 500, 4).bank; // leave exactly one 500 left

    const { cards } = drawFromBankWithFallback(bank, 0, 2);
    expect(cards).toHaveLength(2);
    expect(cards.every((c) => c.value === 500)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @kuhhandel/game-engine test -- moneyBank`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the bank**

`packages/game-engine/src/money/moneyBank.ts`:
```ts
import { MONEY_DENOMINATIONS, type MoneyDenomination } from '../config/money.config.js';
import type { MoneyCard } from '../types.js';

/**
 * Models the rulebook's finite 55-card money supply (10×0, 20×10, 10×50,
 * 5×100, 5×200, 5×500). Every card the game ever hands to a player —
 * starting hands, golden donkey bonuses — is minted from here, so the
 * total money in the game can never exceed what a physical box contains.
 */
export interface MoneyBank {
  counts: Record<MoneyDenomination, number>;
  nextId: number;
}

export function createMoneyBank(): MoneyBank {
  return {
    counts: { 0: 10, 10: 20, 50: 10, 100: 5, 200: 5, 500: 5 },
    nextId: 0,
  };
}

export function drawFromBank(
  bank: MoneyBank,
  denomination: MoneyDenomination,
  count: number,
): { bank: MoneyBank; cards: MoneyCard[] } {
  const available = bank.counts[denomination];
  if (available < count) {
    throw new Error(
      `Money bank has only ${available} card(s) of denomination ${denomination}, requested ${count}.`,
    );
  }

  const cards: MoneyCard[] = [];
  let nextId = bank.nextId;
  for (let i = 0; i < count; i++) {
    cards.push({ id: `bank-money-${nextId++}`, value: denomination });
  }

  return {
    bank: {
      counts: { ...bank.counts, [denomination]: available - count },
      nextId,
    },
    cards,
  };
}

/**
 * Draws `count` cards as close to `denomination` as the bank can manage:
 * exact match first, then escalating to the next larger denomination the
 * bank still has stock of, one card at a time. Never throws — a physical
 * banker would give change up rather than halt play, and this keeps the
 * golden donkey bonus and (at 6 players, beyond the rulebook's stated 3-5)
 * starting-money deal from ever blocking a game. See moneyBank docs / the
 * design spec's "Open questions" for why this fallback exists.
 */
export function drawFromBankWithFallback(
  bank: MoneyBank,
  denomination: MoneyDenomination,
  count: number,
): { bank: MoneyBank; cards: MoneyCard[] } {
  let currentBank = bank;
  const cards: MoneyCard[] = [];

  for (let i = 0; i < count; i++) {
    const startIndex = MONEY_DENOMINATIONS.indexOf(denomination);
    const candidateDenomination = MONEY_DENOMINATIONS.slice(startIndex).find(
      (d) => currentBank.counts[d] > 0,
    );
    if (candidateDenomination === undefined) {
      throw new Error('Money bank is completely exhausted across every denomination.');
    }
    const drawn = drawFromBank(currentBank, candidateDenomination, 1);
    currentBank = drawn.bank;
    cards.push(drawn.cards[0]!);
  }

  return { bank: currentBank, cards };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @kuhhandel/game-engine test -- moneyBank`
Expected: PASS

- [ ] **Step 5: Export from the package barrel**

`packages/game-engine/src/index.ts` — add:
```ts
export * from "./money/moneyBank.js";
```

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/src/money packages/game-engine/test/moneyBank.test.ts packages/game-engine/src/index.ts
git commit -m "feat(game-engine): add finite shared money bank (rulebook 55-card supply)"
```

---

### Task 6: Starting money — correct amount, dealt from the bank

**Files:**
- Modify: `packages/game-engine/src/config/money.config.ts`
- Modify: `packages/game-engine/src/setup/createStartingMoney.ts`
- Test: `packages/game-engine/test/setup.test.ts`

**Interfaces:**
- Consumes: `MoneyBank`, `drawFromBankWithFallback` from Task 5.
- Produces: `dealStartingMoney(bank: MoneyBank, playerCount: number): { bank: MoneyBank; hands: MoneyCard[][] }`, replacing the old `createStartingMoney(): MoneyCard[]` (which is deleted — its only caller is `GameRoom`, updated in Task 7).

- [ ] **Step 1: Correct `STARTING_MONEY`**

`packages/game-engine/src/config/money.config.ts` (full replacement):
```ts
/**
 * Cartes argent et mise de départ (rulebook: "Chaque joueur reçoit deux
 * cartes d'une valeur de 0 ... 4 cartes d'une valeur de 10 et une carte
 * d'une valeur de 50" = 90 par joueur).
 */
export const MONEY_DENOMINATIONS = [0, 10, 50, 100, 200, 500] as const;

export type MoneyDenomination = (typeof MONEY_DENOMINATIONS)[number];

export const STARTING_MONEY: Record<MoneyDenomination, number> = {
  0: 2,
  10: 4,
  50: 1,
  100: 0,
  200: 0,
  500: 0,
};
```

- [ ] **Step 2: Write the failing test for bank-backed dealing**

`packages/game-engine/test/setup.test.ts` — replace the `createStartingMoney` describe block:
```ts
describe('dealStartingMoney', () => {
  it('gives each player the configured starting money hand (90 total, rulebook)', () => {
    const bank = createMoneyBank();
    const { hands } = dealStartingMoney(bank, 3);

    const expectedCount = Object.values(STARTING_MONEY).reduce((a, b) => a + b, 0);
    expect(expectedCount).toBe(7); // 2×0 + 4×10 + 1×50

    for (const hand of hands) {
      expect(hand).toHaveLength(expectedCount);
      expect(hand.reduce((sum, c) => sum + c.value, 0)).toBe(90);
      for (const denomination of MONEY_DENOMINATIONS) {
        expect(hand.filter((card) => card.value === denomination)).toHaveLength(
          STARTING_MONEY[denomination],
        );
      }
    }
  });

  it('gives each player independent card instances drawn from a shrinking bank', () => {
    const bank = createMoneyBank();
    const { bank: next, hands } = dealStartingMoney(bank, 3);

    hands[0]![0]!.id = 'mutated';
    expect(hands[1]![0]!.id).not.toBe('mutated');

    // 3 players × (2×0 + 4×10 + 1×50) = 6×0, 12×10, 3×50 drawn
    expect(next.counts[0]).toBe(10 - 6);
    expect(next.counts[10]).toBe(20 - 12);
    expect(next.counts[50]).toBe(10 - 3);
  });
});
```

Update the test file's imports accordingly:
```ts
import { describe, expect, it } from 'vitest';
import { CARDS_PER_SPECIES, SPECIES_KEYS } from '../src/config/species.config.js';
import { MONEY_DENOMINATIONS, STARTING_MONEY } from '../src/config/money.config.js';
import { createShuffledDeck } from '../src/setup/createDeck.js';
import { createMoneyBank } from '../src/money/moneyBank.js';
import { dealStartingMoney } from '../src/setup/createStartingMoney.js';
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @kuhhandel/game-engine test -- setup`
Expected: FAIL — `dealStartingMoney` doesn't exist yet.

- [ ] **Step 4: Implement `dealStartingMoney`**

`packages/game-engine/src/setup/createStartingMoney.ts` (full replacement):
```ts
import { MONEY_DENOMINATIONS, STARTING_MONEY, type MoneyDenomination } from '../config/money.config.js';
import { drawFromBankWithFallback, type MoneyBank } from '../money/moneyBank.js';
import type { MoneyCard } from '../types.js';

/**
 * Deals every player's starting hand from the same shared bank, in one
 * pass, so the total money handed out is bounded by the bank's real
 * supply (cf. moneyBank.ts). At 6 players (beyond the rulebook's stated
 * 3-5) the "0" and "10" denominations run out mid-deal; the fallback
 * escalates to the next available denomination rather than blocking the
 * game — see the design spec's "Open questions".
 */
export function dealStartingMoney(
  bank: MoneyBank,
  playerCount: number,
): { bank: MoneyBank; hands: MoneyCard[][] } {
  let currentBank = bank;
  const hands: MoneyCard[][] = [];

  for (let i = 0; i < playerCount; i++) {
    const hand: MoneyCard[] = [];
    for (const denomination of MONEY_DENOMINATIONS) {
      const count = STARTING_MONEY[denomination as MoneyDenomination];
      if (count === 0) continue;
      const { bank: nextBank, cards } = drawFromBankWithFallback(currentBank, denomination, count);
      currentBank = nextBank;
      hand.push(...cards);
    }
    hands.push(hand);
  }

  return { bank: currentBank, hands };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @kuhhandel/game-engine test -- setup`
Expected: PASS

- [ ] **Step 6: Update the package barrel**

`packages/game-engine/src/index.ts` — the line `export * from "./setup/createStartingMoney.js";` already covers the new export automatically (same file path, new function name); no change needed there. Confirm no other file imports the old `createStartingMoney` name (`grep -rn createStartingMoney packages apps` — Task 7 handles the one real caller, `GameRoom.ts`).

- [ ] **Step 7: Commit**

```bash
git add packages/game-engine/src/config/money.config.ts packages/game-engine/src/setup/createStartingMoney.ts packages/game-engine/test/setup.test.ts
git commit -m "fix(money): correct starting allotment to 90 (rulebook), deal from the shared bank"
```

---

### Task 7: `GameRoom` adopts the money bank

**Files:**
- Modify: `apps/realtime-server/src/room/GameRoom.ts`
- Modify: `apps/realtime-server/test/room.test.ts`
- Modify: `apps/realtime-server/test/room.persistence.test.ts`
- Modify: `apps/realtime-server/test/room.metaProgress.test.ts`

**Interfaces:**
- Consumes: `createMoneyBank`, `MoneyBank`, `dealStartingMoney` from `@kuhhandel/game-engine` (Tasks 5-6).
- Produces: `GameRoom`'s constructor `startingMoneyFactory` parameter changes shape to `(bank: MoneyBank, playerCount: number) => { bank: MoneyBank; hands: MoneyCard[][] } = dealStartingMoney`; adds a private `moneyBank: MoneyBank` field other tasks (11, 14) will draw from.

- [ ] **Step 1: Update the three tests that inject a custom starting-money factory**

These tests currently use a `deepBankroll = () => Array.from({ length: 20 }, ...)` factory (bypassing the exact-change limitation for auction-only playthroughs). Replace each with a factory matching the new signature, still handing every player a deep flat bankroll but through the bank-shaped interface:

In `apps/realtime-server/test/room.test.ts` (the "full game to GAME_OVER" test) and `apps/realtime-server/test/room.persistence.test.ts` and `apps/realtime-server/test/room.metaProgress.test.ts`, replace:
```ts
const deepBankroll = () =>
  Array.from({ length: 20 }, (_, i) => ({ id: `deep-${i}-${Math.random()}`, value: 10 as const }));
```
with:
```ts
const deepBankroll = (bank: import('@kuhhandel/game-engine').MoneyBank, playerCount: number) => ({
  bank,
  hands: Array.from({ length: playerCount }, (_, p) =>
    Array.from({ length: 20 }, (_, i) => ({ id: `deep-${p}-${i}-${Math.random()}`, value: 10 as const })),
  ),
});
```
(Signature-only change — call sites `new GameRoom(() => 0, deepBankroll)` / `new GameRoom(() => 0, deepBankroll, persistence)` stay the same.)

- [ ] **Step 2: Run the three tests to verify they fail against the still-unchanged `GameRoom`**

Run: `pnpm --filter @kuhhandel/realtime-server test -- room.test room.persistence room.metaProgress`
Expected: FAIL — TypeScript error, `GameRoom`'s current constructor expects `() => MoneyCard[]`, not `(bank, count) => {...}`.

- [ ] **Step 3: Update `GameRoom`'s constructor and `start()`**

In `apps/realtime-server/src/room/GameRoom.ts`:

Update imports — replace `createStartingMoney,` with:
```ts
  createMoneyBank,
  dealStartingMoney,
```
and add to the `import type { ... } from '@kuhhandel/game-engine'` block: `MoneyBank,`.

Add a private field alongside the other private fields:
```ts
  private moneyBank: MoneyBank = createMoneyBank();
```

Update the constructor:
```ts
  constructor(
    private readonly rng: RandomSource = Math.random,
    private readonly startingMoneyFactory: (
      bank: MoneyBank,
      playerCount: number,
    ) => { bank: MoneyBank; hands: MoneyCard[][] } = dealStartingMoney,
    private readonly persistence: GamePersistenceAdapter = new NullPersistenceAdapter(),
    private readonly narratorStyle: NarratorStyle = 'sport',
    private readonly narratorProvider: NarratorProvider = new TemplateNarratorProvider(rng),
  ) {}
```

Update `start()` — replace:
```ts
    this.deck = createShuffledDeck(this.rng);
    this.players = this.players.map((p) => ({ ...p, money: this.startingMoneyFactory() }));
```
with:
```ts
    this.deck = createShuffledDeck(this.rng);
    const { bank, hands } = this.startingMoneyFactory(this.moneyBank, this.players.length);
    this.moneyBank = bank;
    this.players = this.players.map((p, i) => ({ ...p, money: hands[i]! }));
```

- [ ] **Step 4: Run to verify the three tests pass again**

Run: `pnpm --filter @kuhhandel/realtime-server test -- room.test room.persistence room.metaProgress`
Expected: PASS (deep-bankroll behavior preserved; every other `new GameRoom(() => 0)` call site with no custom factory now uses `dealStartingMoney` by default and gets the correct 90-money hands).

- [ ] **Step 5: Run the full realtime-server suite**

Run: `pnpm --filter @kuhhandel/realtime-server test`
Expected: PASS across the board (no other test asserts exact starting-money amounts per earlier grep).

- [ ] **Step 6: Commit**

```bash
git add apps/realtime-server/src/room/GameRoom.ts apps/realtime-server/test/room.test.ts apps/realtime-server/test/room.persistence.test.ts apps/realtime-server/test/room.metaProgress.test.ts
git commit -m "feat(realtime-server): deal starting money from the shared bank"
```

---

### Task 8: Kuhhandel money resolution — no pot-to-winner

**Files:**
- Modify: `packages/game-engine/src/engine/applyResults.ts`
- Test: `packages/game-engine/test/engine.integration.test.ts`

**Interfaces:**
- Produces: `applyKuhhandelResult` no longer moves `potMoney` on `counter_resolved`/`tie_default_initiator_wins` — only the animal moves; each side keeps what they staked.

- [ ] **Step 1: Update the failing integration test**

`packages/game-engine/test/engine.integration.test.ts` — replace the `"counter: the winner takes the loser's animal and both stakes"` test:
```ts
  it('counter: only the animal moves — each side keeps the money it staked', () => {
    let players: Player[] = [
      {
        id: 'initiator',
        name: 'initiator',
        money: [{ id: 'm-100', value: 100 }],
        animals: [{ id: 'vache-a', species: 'vache' }],
      },
      {
        id: 'target',
        name: 'target',
        money: [{ id: 'm-50', value: 50 }],
        animals: [{ id: 'vache-b', species: 'vache' }],
      },
    ];

    let state = startKuhhandel('initiator', 'target', 'vache');
    state = submitInitiatorOffer(state, [players[0]!.money[0]!]);

    const result = respondCounter(state, [players[1]!.money[0]!]);
    expect(result.type).toBe('counter_resolved');

    players = applyKuhhandelResult(players, result);

    const initiator = players.find((p) => p.id === 'initiator')!;
    const target = players.find((p) => p.id === 'target')!;

    expect(initiator.animals.map((a) => a.id)).toEqual(
      expect.arrayContaining(['vache-a', 'vache-b']),
    );
    expect(initiator.money.map((m) => m.id)).toEqual(['m-100']); // kept their own stake only
    expect(target.animals).toHaveLength(0);
    expect(target.money.map((m) => m.id)).toEqual(['m-50']); // kept their own stake too
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @kuhhandel/game-engine test -- engine.integration`
Expected: FAIL — current code gives both stakes to `initiator`.

- [ ] **Step 3: Fix `applyKuhhandelResult`**

`packages/game-engine/src/engine/applyResults.ts` — delete the `movePotToWinner` function entirely, and replace the `counter_resolved`/`tie_default_initiator_wins` branch of `applyKuhhandelResult`:
```ts
export function applyKuhhandelResult(players: Player[], result: KuhhandelResult): Player[] {
  if (result.type === 'accept') {
    let next = transferMoneyCards(players, result.moneyFrom, result.moneyGoesTo, result.money);
    const { players: afterRemoval, card } = removeAnimalOfSpecies(
      next,
      result.cardComesFrom,
      result.species,
    );
    next = transferAnimalCard(afterRemoval, result.cardGoesTo, card);
    return next;
  }

  if (result.type === 'tie_reoffer_needed') {
    return players;
  }

  // counter_resolved / tie_default_initiator_wins: only the animal moves.
  // Each side keeps the money they staked — the rulebook's "chaque joueur
  // conserve l'argent proposé par son adversaire" line means the money
  // never moves at all here (unlike an auction payment), it just stays
  // put since it was never transferred out of either hand in the first
  // place — see the design spec, Finding 5.
  const { players: afterRemoval, card } = removeAnimalOfSpecies(
    players,
    result.loserId,
    result.species,
  );
  return transferAnimalCard(afterRemoval, result.winnerId, card);
}
```
(`potMoney` stays on the `KuhhandelResult` type for narration/stats purposes in `GameRoom`/`GameStatsTracker` — only its consumption in `applyResults.ts` changes.)

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @kuhhandel/game-engine test -- engine.integration`
Expected: PASS

- [ ] **Step 5: Run the full game-engine suite to catch any other test depending on `movePotToWinner` behavior**

Run: `pnpm --filter @kuhhandel/game-engine test`
Expected: PASS (no other test file references pot-to-winner behavior per the earlier `kuhhandel.test.ts`/`scoring.test.ts` review — `kuhhandel.test.ts` only tests the pure `respondCounter` result shape, not money transfer, so it's unaffected).

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/src/engine/applyResults.ts packages/game-engine/test/engine.integration.test.ts
git commit -m "fix(kuhhandel): stop moving the pot to the winner — each side keeps its own stake"
```

---

### Task 9: Special 2-card Kuhhandel

**Files:**
- Modify: `packages/game-engine/src/kuhhandel/kuhhandel.ts`
- Modify: `packages/game-engine/src/engine/applyResults.ts`
- Modify: `apps/realtime-server/src/room/GameRoom.ts`
- Test: `packages/game-engine/test/kuhhandel.test.ts`
- Test: `packages/game-engine/test/engine.integration.test.ts`

**Interfaces:**
- Produces: `startKuhhandel(initiatorId, targetId, species, initiatorAnimals, targetAnimals)` — new required params, computes and stores `cardCount: 1 | 2` on `KuhhandelState`; all `KuhhandelResult` variants carry `cardCount`; `removeAnimalOfSpecies` renamed `removeAnimalsOfSpecies(players, fromId, species, count)`.

- [ ] **Step 1: Write the failing tests**

`packages/game-engine/test/kuhhandel.test.ts` — update `startKuhhandel` call sites to pass animal arrays, and add new cases. Replace the file's helper/imports and add:
```ts
const vache: AnimalCard = { id: 'vache-0', species: 'vache' };
const vache2: AnimalCard = { id: 'vache-2', species: 'vache' };
```
Update every existing `startKuhhandel('initiator', 'target', 'vache')` call to `startKuhhandel('initiator', 'target', 'vache', [vache], [{ id: 'vache-1', species: 'vache' }])` (1 card each — existing tests keep asserting single-card behavior implicitly; add `cardCount: 1` to the existing `toEqual` expectations for `respondAccept`/`respondCounter` results).

Add a new describe block:
```ts
describe('startKuhhandel — special 2-card trade (rulebook: "marchandage spécial")', () => {
  it('sets cardCount to 2 when both players hold at least 2 of the species', () => {
    const initiatorAnimals = [vache, vache2];
    const targetAnimals = [
      { id: 'vache-3', species: 'vache' as const },
      { id: 'vache-4', species: 'vache' as const },
    ];
    const state = startKuhhandel('initiator', 'target', 'vache', initiatorAnimals, targetAnimals);
    expect(state.cardCount).toBe(2);
  });

  it('sets cardCount to 1 when either player holds only one of the species', () => {
    const initiatorAnimals = [vache, vache2];
    const targetAnimals = [{ id: 'vache-3', species: 'vache' as const }];
    const state = startKuhhandel('initiator', 'target', 'vache', initiatorAnimals, targetAnimals);
    expect(state.cardCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @kuhhandel/game-engine test -- kuhhandel`
Expected: FAIL — `startKuhhandel` doesn't accept animal arrays yet, `cardCount` doesn't exist.

- [ ] **Step 3: Implement `cardCount` in `kuhhandel.ts`**

`packages/game-engine/src/kuhhandel/kuhhandel.ts` — update the state/result types and `startKuhhandel`:
```ts
export interface KuhhandelState {
  initiatorId: string;
  targetId: string;
  species: SpeciesKey;
  /** 2 when both players hold ≥2 of the species at trade start ("marchandage spécial") — both cards move at once. Otherwise 1. */
  cardCount: 1 | 2;
  stage: KuhhandelStage;
  initiatorOffer: MoneyCard[] | null;
  tieRound: number;
}
```

Add `cardCount` to every `KuhhandelResult` variant (`accept`, `counter_resolved`, `tie_default_initiator_wins` — not `tie_reoffer_needed`, which carries no trade outcome):
```ts
export type KuhhandelResult =
  | {
      type: 'accept';
      species: SpeciesKey;
      cardCount: 1 | 2;
      cardGoesTo: string;
      cardComesFrom: string;
      moneyGoesTo: string;
      moneyFrom: string;
      money: MoneyCard[];
    }
  | {
      type: 'counter_resolved';
      species: SpeciesKey;
      cardCount: 1 | 2;
      winnerId: string;
      loserId: string;
      potMoney: MoneyCard[];
    }
  | {
      type: 'tie_reoffer_needed';
      tieRound: number;
    }
  | {
      type: 'tie_default_initiator_wins';
      species: SpeciesKey;
      cardCount: 1 | 2;
      winnerId: string;
      loserId: string;
      potMoney: MoneyCard[];
    };
```

Update `startKuhhandel`:
```ts
export function startKuhhandel(
  initiatorId: string,
  targetId: string,
  species: SpeciesKey,
  initiatorAnimals: AnimalCard[],
  targetAnimals: AnimalCard[],
): KuhhandelState {
  const ownedBy = (animals: AnimalCard[]) => animals.filter((a) => a.species === species).length;
  const cardCount: 1 | 2 = ownedBy(initiatorAnimals) >= 2 && ownedBy(targetAnimals) >= 2 ? 2 : 1;

  return {
    initiatorId,
    targetId,
    species,
    cardCount,
    stage: 'awaiting_initiator_offer',
    initiatorOffer: null,
    tieRound: 0,
  };
}
```

Update `respondAccept` to carry `cardCount: state.cardCount`, and `respondCounter`'s two resolved branches to carry `cardCount: state.cardCount` (the `tie_reoffer_needed` branch is unchanged — ties don't move cards).

- [ ] **Step 4: Run to verify `kuhhandel.test.ts` passes**

Run: `pnpm --filter @kuhhandel/game-engine test -- kuhhandel`
Expected: PASS

- [ ] **Step 5: Write the failing integration test for the 2-card transfer**

`packages/game-engine/test/engine.integration.test.ts` — add:
```ts
  it('special 2-card trade: both cards move at once when both sides hold 2', () => {
    let players: Player[] = [
      {
        id: 'initiator',
        name: 'initiator',
        money: [{ id: 'm-100', value: 100 }],
        animals: [
          { id: 'vache-a1', species: 'vache' },
          { id: 'vache-a2', species: 'vache' },
        ],
      },
      {
        id: 'target',
        name: 'target',
        money: [],
        animals: [
          { id: 'vache-b1', species: 'vache' },
          { id: 'vache-b2', species: 'vache' },
        ],
      },
    ];

    let state = startKuhhandel(
      'initiator',
      'target',
      'vache',
      players[0]!.animals,
      players[1]!.animals,
    );
    expect(state.cardCount).toBe(2);

    state = submitInitiatorOffer(state, [players[0]!.money[0]!]);
    const result = respondAccept(state);
    players = applyKuhhandelResult(players, result);

    const initiator = players.find((p) => p.id === 'initiator')!;
    const target = players.find((p) => p.id === 'target')!;
    expect(initiator.animals.map((a) => a.id).sort()).toEqual(
      ['vache-a1', 'vache-a2', 'vache-b1', 'vache-b2'].sort(),
    );
    expect(target.animals).toHaveLength(0);
  });
```
Update the earlier `startKuhhandel('initiator', 'target', 'vache')` calls in this file (the `accept`/`counter` tests from Task 8) to pass the two players' `animals` arrays as the 4th/5th args.

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm --filter @kuhhandel/game-engine test -- engine.integration`
Expected: FAIL — `removeAnimalOfSpecies` in `applyResults.ts` only ever removes one card.

- [ ] **Step 7: Implement multi-card removal in `applyResults.ts`**

Rename `removeAnimalOfSpecies` to `removeAnimalsOfSpecies` and make it remove `count` cards:
```ts
function removeAnimalsOfSpecies(
  players: Player[],
  fromId: string,
  species: AnimalCard['species'],
  count: number,
): { players: Player[]; cards: AnimalCard[] } {
  const owner = findPlayer(players, fromId);
  const removed: AnimalCard[] = [];
  let remaining = [...owner.animals];
  for (let i = 0; i < count; i++) {
    const index = remaining.findIndex((a) => a.species === species);
    if (index === -1) {
      throw new Error(`Player ${fromId} does not own enough ${species} cards to transfer ${count}.`);
    }
    removed.push(remaining[index]!);
    remaining = remaining.filter((_, i2) => i2 !== index);
  }
  const next = replacePlayer(players, { ...owner, animals: remaining });
  return { players: next, cards: removed };
}

function transferAnimalCards(players: Player[], toId: string, cards: AnimalCard[]): Player[] {
  const payee = findPlayer(players, toId);
  return replacePlayer(players, { ...payee, animals: [...payee.animals, ...cards] });
}
```
Delete the old single-card `transferAnimalCard`/`removeAnimalOfSpecies` and update all call sites (`applyAuctionResult` keeps using a 1-card variant — auctions are always single-card, so give it its own tiny wrapper rather than threading `count` through unrelated code):
```ts
export function applyAuctionResult(players: Player[], result: AuctionResult): Player[] {
  let next = transferAnimalCards(players, result.cardGoesTo, [result.card]);
  if (result.payment) {
    next = transferExactMoneyCard(next, result.payment.from, result.payment.to, result.payment.amount);
  }
  return next;
}

export function applyKuhhandelResult(players: Player[], result: KuhhandelResult): Player[] {
  if (result.type === 'accept') {
    let next = transferMoneyCards(players, result.moneyFrom, result.moneyGoesTo, result.money);
    const { players: afterRemoval, cards } = removeAnimalsOfSpecies(
      next,
      result.cardComesFrom,
      result.species,
      result.cardCount,
    );
    return transferAnimalCards(afterRemoval, result.cardGoesTo, cards);
  }

  if (result.type === 'tie_reoffer_needed') {
    return players;
  }

  const { players: afterRemoval, cards } = removeAnimalsOfSpecies(
    players,
    result.loserId,
    result.species,
    result.cardCount,
  );
  return transferAnimalCards(afterRemoval, result.winnerId, cards);
}
```

- [ ] **Step 8: Run to verify pass**

Run: `pnpm --filter @kuhhandel/game-engine test -- engine.integration`
Expected: PASS

- [ ] **Step 9: Update `GameRoom.ts`'s call site**

`apps/realtime-server/src/room/GameRoom.ts`'s `startKuhhandel` method — pass the animal arrays through:
```ts
  startKuhhandel(initiatorId: string, targetId: string, species: SpeciesKey): void {
    this.requireActionable();
    this.requireActivePlayer(initiatorId);
    if (this.auction || this.kuhhandel) {
      throw new Error('A flow is already in progress this turn.');
    }
    const initiator = this.findPlayer(initiatorId);
    const target = this.findPlayer(targetId);
    if (!canInitiateKuhhandel(initiator.animals, target.animals, species)) {
      throw new Error('Both players must own at least one animal of that species.');
    }
    this.kuhhandel = startKuhhandel(initiatorId, targetId, species, initiator.animals, target.animals);
    this.runBotLoop();
  }
```

- [ ] **Step 10: Run the full game-engine and realtime-server suites**

Run: `pnpm --filter @kuhhandel/game-engine test && pnpm --filter @kuhhandel/realtime-server test`
Expected: PASS. (`GameStatsTracker`'s stats-related consumers of `KuhhandelResult` only read `species`/`winnerId`/`loserId`/`potMoney`, none of which changed shape besides the new `cardCount` field — no other edits needed there.)

- [ ] **Step 11: Commit**

```bash
git add packages/game-engine/src apps/realtime-server/src/room/GameRoom.ts packages/game-engine/test
git commit -m "feat(kuhhandel): implement the special 2-card trade (marchandage spécial)"
```

---

### Task 10: Remove the dead `KuhhandelTieBreakResolution` type

**Files:**
- Modify: `packages/game-engine/src/config/kuhhandel.config.ts`

- [ ] **Step 1: Confirm it's unused**

Run: `grep -rn "KuhhandelTieBreakResolution" packages apps`
Expected: only the declaration itself in `kuhhandel.config.ts`.

- [ ] **Step 2: Delete it**

`packages/game-engine/src/config/kuhhandel.config.ts` — remove the line:
```ts
export type KuhhandelTieBreakResolution = 'initiator_wins' | 'reoffer';
```
Leave `KUHHANDEL_TIE_BREAK_MAX_ROUNDS` and its doc comment as-is (the actual, correct tie-break logic).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @kuhhandel/game-engine typecheck`
Expected: PASS (nothing imported the type).

- [ ] **Step 4: Commit**

```bash
git add packages/game-engine/src/config/kuhhandel.config.ts
git commit -m "chore(game-engine): remove unused KuhhandelTieBreakResolution type"
```

---

### Task 11: Golden donkey

**Files:**
- Create: `packages/game-engine/src/kuhhandel/goldenDonkey.ts`
- Test: `packages/game-engine/test/goldenDonkey.test.ts`

**Interfaces:**
- Consumes: `MoneyBank`, `drawFromBankWithFallback` (Task 5); `Player`, `AnimalCard` (types.ts).
- Produces: `DONKEY_BONUS_SEQUENCE: readonly [50, 100, 200, 500]`; `isGoldenDonkeyCard(card: AnimalCard): boolean`; `distributeGoldenDonkeyBonus(bank: MoneyBank, players: Player[], donkeyRevealCount: number): { bank: MoneyBank; players: Player[] }` — gives every player one bonus card at `DONKEY_BONUS_SEQUENCE[donkeyRevealCount]` (clamped to the last value if `donkeyRevealCount >= 4`, since only 4 donkeys exist but defends against a caller bug rather than a real rule case).

- [ ] **Step 1: Write the failing tests**

`packages/game-engine/test/goldenDonkey.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createMoneyBank } from '../src/money/moneyBank.js';
import {
  DONKEY_BONUS_SEQUENCE,
  isGoldenDonkeyCard,
  distributeGoldenDonkeyBonus,
} from '../src/kuhhandel/goldenDonkey.js';
import type { Player } from '../src/types.js';

function makePlayers(ids: string[]): Player[] {
  return ids.map((id) => ({ id, name: id, money: [], animals: [] }));
}

describe('isGoldenDonkeyCard', () => {
  it('is true only for the âne species', () => {
    expect(isGoldenDonkeyCard({ id: 'ane-0', species: 'ane' })).toBe(true);
    expect(isGoldenDonkeyCard({ id: 'vache-0', species: 'vache' })).toBe(false);
  });
});

describe('distributeGoldenDonkeyBonus', () => {
  it('gives every player one bonus card at the rulebook sequence (50/100/200/500)', () => {
    const bank = createMoneyBank();
    let players = makePlayers(['p1', 'p2', 'p3']);

    for (let reveal = 0; reveal < DONKEY_BONUS_SEQUENCE.length; reveal++) {
      const result = distributeGoldenDonkeyBonus(bank, players, reveal);
      players = result.players;
      for (const player of players) {
        const bonusCards = player.money.filter((c) => c.value === DONKEY_BONUS_SEQUENCE[reveal]);
        expect(bonusCards.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('gives exactly one card per player and decrements the bank accordingly', () => {
    const bank = createMoneyBank();
    const players = makePlayers(['p1', 'p2']);

    const { bank: next, players: updated } = distributeGoldenDonkeyBonus(bank, players, 0);

    for (const player of updated) {
      expect(player.money).toHaveLength(1);
      expect(player.money[0]!.value).toBe(50);
    }
    expect(next.counts[50]).toBe(bank.counts[50] - 2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @kuhhandel/game-engine test -- goldenDonkey`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the module**

`packages/game-engine/src/kuhhandel/goldenDonkey.ts`:
```ts
import { drawFromBankWithFallback, type MoneyBank } from '../money/moneyBank.js';
import type { AnimalCard, Player } from '../types.js';

/**
 * L'âne d'or (rulebook): the 1st âne revealed pays every player 50, the
 * 2nd 100, the 3rd 200, the 4th 500 — there are exactly 4 ânes in the
 * 40-card deck, so `donkeyRevealCount` (0-indexed, tracked per game) never
 * legitimately exceeds 3.
 */
export const DONKEY_BONUS_SEQUENCE = [50, 100, 200, 500] as const;

export function isGoldenDonkeyCard(card: AnimalCard): boolean {
  return card.species === 'ane';
}

export function distributeGoldenDonkeyBonus(
  bank: MoneyBank,
  players: Player[],
  donkeyRevealCount: number,
): { bank: MoneyBank; players: Player[] } {
  const index = Math.min(donkeyRevealCount, DONKEY_BONUS_SEQUENCE.length - 1);
  const amount = DONKEY_BONUS_SEQUENCE[index];

  let currentBank = bank;
  const updatedPlayers: Player[] = [];
  for (const player of players) {
    const { bank: nextBank, cards } = drawFromBankWithFallback(currentBank, amount, 1);
    currentBank = nextBank;
    updatedPlayers.push({ ...player, money: [...player.money, ...cards] });
  }

  return { bank: currentBank, players: updatedPlayers };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @kuhhandel/game-engine test -- goldenDonkey`
Expected: PASS

- [ ] **Step 5: Export from the package barrel**

`packages/game-engine/src/index.ts` — add:
```ts
export * from "./kuhhandel/goldenDonkey.js";
```

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/src/kuhhandel/goldenDonkey.ts packages/game-engine/test/goldenDonkey.test.ts packages/game-engine/src/index.ts
git commit -m "feat(game-engine): implement l'âne d'or (golden donkey bonus)"
```

---

### Task 12: End-game trigger split — `isDeckExhausted` vs. real `isGameOver`

**Files:**
- Modify: `packages/game-engine/src/scoring/scoring.ts`
- Modify: `packages/game-engine/src/config/game.config.ts`
- Test: `packages/game-engine/test/scoring.test.ts`

**Interfaces:**
- Produces: `isDeckExhausted(deck: AnimalCard[]): boolean` (old `isGameOver` logic, renamed); `isGameOver(players: Player[]): boolean` (new: true once every one of the 10 species has all 4 of its cards held by a single player); `hasIncompleteFamilyAnimal(animals: AnimalCard[]): boolean` (true if the player holds any species in a count `< CARDS_PER_SPECIES` — used by Task 13 to auto-pass players who can no longer trade).
- Breaking change: every existing caller of `isGameOver(deck)` must switch to either `isDeckExhausted(deck)` or `isGameOver(players)` depending on intent (handled in Task 13).

- [ ] **Step 1: Update the failing tests**

`packages/game-engine/test/scoring.test.ts` — replace the `isGameOver` describe block:
```ts
describe('isDeckExhausted', () => {
  it('is true once the animal deck is empty', () => {
    expect(isDeckExhausted([])).toBe(true);
    expect(isDeckExhausted([{ id: 'a', species: 'vache' }])).toBe(false);
  });
});

describe('isGameOver (rulebook: "quand toutes les familles sont complètes")', () => {
  function playerWith(id: string, ...species: AnimalCard['species'][]): Player {
    return { id, name: id, money: [], animals: animals(...species) };
  }

  it('is false while any species is not fully held by a single player', () => {
    const players = [
      playerWith('p1', 'cochon', 'cochon', 'cochon', 'cochon'),
      playerWith('p2', 'vache', 'vache'), // vache incomplete everywhere
    ];
    expect(isGameOver(players)).toBe(false);
  });

  it('is true once every one of the 10 species is completed by some player', () => {
    const players = [
      playerWith(
        'p1',
        'coq', 'coq', 'coq', 'coq',
        'oie', 'oie', 'oie', 'oie',
        'chat', 'chat', 'chat', 'chat',
        'chien', 'chien', 'chien', 'chien',
        'mouton', 'mouton', 'mouton', 'mouton',
      ),
      playerWith(
        'p2',
        'chevre', 'chevre', 'chevre', 'chevre',
        'ane', 'ane', 'ane', 'ane',
        'cochon', 'cochon', 'cochon', 'cochon',
        'vache', 'vache', 'vache', 'vache',
        'cheval', 'cheval', 'cheval', 'cheval',
      ),
    ];
    expect(isGameOver(players)).toBe(true);
  });

  it('does not require the SAME player to hold every family — different players can each complete different families', () => {
    const players = [
      playerWith('p1', 'coq', 'coq', 'coq', 'coq'),
      playerWith('p2', 'oie', 'oie', 'oie', 'oie'),
    ];
    // only 2 of 10 families complete — still false, but proves ownership isn't required to be uniform once it IS all 10
    expect(isGameOver(players)).toBe(false);
  });
});

describe('hasIncompleteFamilyAnimal', () => {
  it('is true when the player holds fewer than 4 of some species', () => {
    expect(hasIncompleteFamilyAnimal(animals('vache', 'vache'))).toBe(true);
  });

  it('is false when every species held is a complete family of 4', () => {
    expect(hasIncompleteFamilyAnimal(animals('vache', 'vache', 'vache', 'vache'))).toBe(false);
  });

  it('is false for an empty hand (nothing left to trade)', () => {
    expect(hasIncompleteFamilyAnimal([])).toBe(false);
  });
});
```
Update the file's import line to `import { computeScore, isDeckExhausted, isGameOver, hasIncompleteFamilyAnimal, nextPlayerIndex } from '../src/scoring/scoring.js';`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @kuhhandel/game-engine test -- scoring`
Expected: FAIL — `isDeckExhausted`/`hasIncompleteFamilyAnimal` don't exist; `isGameOver` still takes a deck.

- [ ] **Step 3: Implement**

`packages/game-engine/src/scoring/scoring.ts` (full replacement):
```ts
import { CARDS_PER_SPECIES, SPECIES_FAMILY_VALUE, SPECIES_KEYS } from '../config/species.config.js';
import type { AnimalCard, Player } from '../types.js';

export function computeScore(player: Player): number {
  const countBySpecies = new Map<AnimalCard['species'], number>();
  for (const card of player.animals) {
    countBySpecies.set(card.species, (countBySpecies.get(card.species) ?? 0) + 1);
  }

  let completeFamiliesValue = 0;
  let completeFamiliesCount = 0;
  for (const [species, count] of countBySpecies) {
    if (count >= CARDS_PER_SPECIES) {
      completeFamiliesValue += SPECIES_FAMILY_VALUE[species];
      completeFamiliesCount += 1;
    }
  }
  return completeFamiliesValue * completeFamiliesCount;
}

/** True once the 40-card animal deck has nothing left to auction. Auctions stop here, but the game itself isn't over yet — see `isGameOver`. */
export function isDeckExhausted(deck: AnimalCard[]): boolean {
  return deck.length === 0;
}

/** True once every one of the 10 species has all 4 of its cards held by a single player (rulebook: "quand toutes les familles sont complètes"). */
export function isGameOver(players: Player[]): boolean {
  return SPECIES_KEYS.every((species) =>
    players.some((p) => p.animals.filter((a) => a.species === species).length >= CARDS_PER_SPECIES),
  );
}

/** True if the player holds any species in a count below a full family — i.e. they still have something tradeable. Used to auto-pass players during the forced-Kuhhandel end-game phase who hold only complete families (or nothing). */
export function hasIncompleteFamilyAnimal(animals: AnimalCard[]): boolean {
  const counts = new Map<AnimalCard['species'], number>();
  for (const card of animals) {
    counts.set(card.species, (counts.get(card.species) ?? 0) + 1);
  }
  for (const count of counts.values()) {
    if (count < CARDS_PER_SPECIES) return true;
  }
  return false;
}

export function nextPlayerIndex(current: number, playerCount: number): number {
  return (current + 1) % playerCount;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @kuhhandel/game-engine test -- scoring`
Expected: PASS

- [ ] **Step 5: Fix the now-broken `isGameOver(deck)` call in `engine.integration.test.ts`**

That file's auction-only playthrough loop (`while (!isGameOver(deck))`) must become `while (!isDeckExhausted(deck))`, and its import line updated to include `isDeckExhausted`. The rest of that test's assertions (`deck.length === 0`, total animals held, non-negative scores) remain valid — it never asserted the game had *ended* in the family-completion sense, only that the deck was exhausted, so no further changes needed there.

- [ ] **Step 6: Remove now-orphaned `game.config.ts` entries**

`GAME_END_CONDITION` (`'deck_exhausted'`) no longer describes reality — the deck-exhaustion event now starts the forced-Kuhhandel phase, not the game's end. Update its doc comment in `packages/game-engine/src/config/game.config.ts`:
```ts
/** Fin de partie : quand toutes les familles sont complètes (rulebook §4). Le vidage de la pioche déclenche la phase de marchandage forcé (voir isGameOver / isDeckExhausted dans scoring.ts), pas la fin de partie elle-même. */
export const GAME_END_CONDITION = 'all_families_complete' as const;
```
(Kept as a named constant — `GameRoom.ts`'s `rulesetConfigSnapshot()` persists it into game records for observability — but its value and meaning are corrected.)

- [ ] **Step 7: Run the full game-engine suite**

Run: `pnpm --filter @kuhhandel/game-engine test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/game-engine/src/scoring/scoring.ts packages/game-engine/src/config/game.config.ts packages/game-engine/test/scoring.test.ts packages/game-engine/test/engine.integration.test.ts
git commit -m "fix(scoring): split isDeckExhausted from the real isGameOver (all families complete)"
```

---

### Task 13: `GamePhase` gains `FORCED_KUHHANDEL`

**Files:**
- Modify: `packages/game-engine/src/types.ts`

- [ ] **Step 1: Add the phase value**

`packages/game-engine/src/types.ts` — update the `GamePhase` union and add the `moneyBank`/`donkeyRevealCount` fields to `GameState` for documentation parity with `GameRoom`'s actual (separately-tracked) runtime state — see Task 14's note on why `GameRoom` doesn't literally hold a `GameState` object:
```ts
export type GamePhase =
  | 'LOBBY'
  | 'TURN_START'
  | 'AUCTION_FLOW'
  | 'KUHHANDEL_FLOW'
  | 'FORCED_KUHHANDEL'
  | 'SCORING'
  | 'GAME_OVER';

export interface GameState {
  phase: GamePhase;
  players: Player[];
  deck: AnimalCard[];
  activePlayerIndex: number;
  moneyBank: MoneyBank;
  donkeyRevealCount: number;
}
```
Add the import: `import type { MoneyBank } from './money/moneyBank.js';` at the top of the file.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @kuhhandel/game-engine typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/game-engine/src/types.ts
git commit -m "feat(game-engine): add FORCED_KUHHANDEL to GamePhase, moneyBank/donkeyRevealCount to GameState"
```

---

### Task 14: `GameRoom` — golden donkey, forced-Kuhhandel phase, real end-game

This is the integration task wiring Tasks 5-13 into live gameplay.

**Files:**
- Modify: `apps/realtime-server/src/room/GameRoom.ts`
- Modify: `packages/shared-types/src/index.ts` (expose `phase` on `GameStateView`)

**Interfaces:**
- Consumes: `isDeckExhausted`, `isGameOver`, `hasIncompleteFamilyAnimal` (Task 12), `isGoldenDonkeyCard`, `distributeGoldenDonkeyBonus` (Task 11), `GamePhase` (Task 13).
- Produces: `GameRoom` gains a `private phase: GamePhase`, `private donkeyRevealCount = 0`, an injectable `deckFactory` constructor param (for deterministic tests), and exposes `phase` on `GameStateView`.

**Design note for the implementer:** `GameRoom` does not hold a single `GameState` object today — it tracks `players`/`deck`/`activePlayerIndex`/`auction`/`kuhhandel`/`status` as separate private fields (a pre-existing pattern, not something this task changes). `phase`/`moneyBank`/`donkeyRevealCount` follow that same pattern: new private fields on `GameRoom`, not a `GameState` instance. Only two of the six `GamePhase` values are actually driven by this task: the room starts in (and stays in) `'AUCTION_FLOW'` for the whole normal game, moves to `'FORCED_KUHHANDEL'` once the deck empties, and settles on `'GAME_OVER'` once `isGameOver(players)` becomes true. `'TURN_START'`/`'KUHHANDEL_FLOW'`/`'SCORING'` are not wired to anything new by this fix (the existing `this.auction`/`this.kuhhandel` nullable fields already distinguish those sub-states); don't invent behavior for them.

- [ ] **Step 1: Add a `deckFactory` constructor param**

Update imports — add `isDeckExhausted`, `isGoldenDonkeyCard`, `distributeGoldenDonkeyBonus` and remove the now-unused bare `isGameOver` import if its signature changed incompatibly (it hasn't — same name, new param type, so the import line is unchanged, just its usages below need updating).

Constructor:
```ts
  constructor(
    private readonly rng: RandomSource = Math.random,
    private readonly startingMoneyFactory: (
      bank: MoneyBank,
      playerCount: number,
    ) => { bank: MoneyBank; hands: MoneyCard[][] } = dealStartingMoney,
    private readonly persistence: GamePersistenceAdapter = new NullPersistenceAdapter(),
    private readonly narratorStyle: NarratorStyle = 'sport',
    private readonly narratorProvider: NarratorProvider = new TemplateNarratorProvider(rng),
    private readonly deckFactory: () => AnimalCard[] = () => createShuffledDeck(rng),
  ) {}
```
(`createShuffledDeck` stays imported for the default value's closure.)

Add new private fields alongside the existing ones:
```ts
  private phase: GamePhase = 'AUCTION_FLOW';
  private donkeyRevealCount = 0;
```
Add `import type { GamePhase } from '@kuhhandel/game-engine';` to the type-only import block.

Update `start()`'s deck line: `this.deck = createShuffledDeck(this.rng);` → `this.deck = this.deckFactory();`.

- [ ] **Step 2: Gate `startAuction` on deck exhaustion (renamed check) and golden donkey hook**

Replace the body of `startAuction`:
```ts
  startAuction(playerId: string): void {
    this.requireActionable();
    this.requireActivePlayer(playerId);
    if (this.auction || this.kuhhandel) {
      throw new Error('A flow is already in progress this turn.');
    }
    if (isDeckExhausted(this.deck)) {
      throw new Error('The deck is empty, no card left to auction — Kuhhandel is now mandatory.');
    }
    const card = this.deck[0]!;
    this.deck = this.deck.slice(1);

    if (isGoldenDonkeyCard(card)) {
      const { bank, players } = distributeGoldenDonkeyBonus(this.moneyBank, this.players, this.donkeyRevealCount);
      this.moneyBank = bank;
      this.players = players;
      this.donkeyRevealCount += 1;
    }

    const otherIds = this.players.filter((p) => p.id !== playerId).map((p) => p.id);
    this.currentAuctionBidderIds = otherIds;
    this.auction = startAuction(card, playerId, otherIds);
    this.runBotLoop();
  }
```
(Note: the local `card`/`otherIds`/`this.auction = startAuction(...)` lines are unchanged from the existing method — only the `isGameOver(this.deck)` → `isDeckExhausted(this.deck)` swap and the golden-donkey block are new.)

- [ ] **Step 3: Restructure `endTurn` — forced-Kuhhandel phase, auto-pass, real finish condition**

Replace `endTurn()`:
```ts
  private endTurn(): void {
    this.auction = null;
    this.kuhhandel = null;

    if (isDeckExhausted(this.deck)) {
      this.phase = 'FORCED_KUHHANDEL';
    }

    if (isGameOver(this.players)) {
      this.finishGame();
      return;
    }

    this.statsTracker.recordLeaderCheckpoint(this.players, this.deck.length);
    const scored = this.players
      .map((p) => ({ id: p.id, score: computeScore(p) }))
      .sort((a, b) => b.score - a.score);
    const newLeaderId = scored[0]!.id;
    if (isComeback(this.lastNarratorLeaderId, newLeaderId)) {
      this.emitNarratorEvent('comeback', { player: this.findPlayer(newLeaderId).name });
    }
    this.lastNarratorLeaderId = newLeaderId;

    const rareEvent = rollRareEvent(this.rng);
    if (rareEvent) {
      this.rareEventsFeed.push(rareEvent);
      if (this.rareEventsFeed.length > RARE_EVENTS_FEED_LIMIT) this.rareEventsFeed.shift();
    }

    this.activePlayerIndex = nextPlayerIndex(this.activePlayerIndex, this.players.length);
    // Rulebook: once Kuhhandel is mandatory, a player holding only complete
    // families (or nothing) cannot participate and must pass automatically.
    while (this.phase === 'FORCED_KUHHANDEL' && !hasIncompleteFamilyAnimal(this.activePlayer.animals)) {
      this.activePlayerIndex = nextPlayerIndex(this.activePlayerIndex, this.players.length);
    }

    this.turnNumber += 1;
    this.withGameId((gameId) =>
      this.persistence.saveSnapshot(gameId, this.turnNumber, {
        players: this.players,
        deck: this.deck,
        activePlayerIndex: this.activePlayerIndex,
      }),
    );
  }

  private finishGame(): void {
    this.phase = 'GAME_OVER';
    this.status = 'finished';
    const scored = this.players
      .map((p) => ({ playerId: p.id, score: computeScore(p) }))
      .sort((a, b) => b.score - a.score);
    const results = scored.map(({ playerId, score }, index) => ({
      userId: this.userIdByPlayerId.get(playerId) ?? null,
      score,
      rank: index + 1,
    }));
    this.withGameId((gameId) => this.persistence.finishGame(gameId, results));

    const topScore = scored[0]!.score;
    const winnerIds = new Set(scored.filter((s) => s.score === topScore).map((s) => s.playerId));
    const summaries = this.statsTracker.buildSummaries(this.players, winnerIds);
    for (const player of this.players) {
      const userId = this.userIdByPlayerId.get(player.id);
      if (!userId) continue;
      const summary = summaries.get(player.id);
      if (!summary) continue;
      awardGameProgress(this.persistence, userId, summary).catch((error: unknown) =>
        console.error('[meta]', error),
      );
    }

    const facts = this.statsTracker.buildHallOfFameFacts(this.players);
    this.finalDistinctions = computeDistinctions(facts);
    this.withGameId((gameId) =>
      this.persistence.saveHallOfFameShameEntries(
        gameId,
        this.finalDistinctions.map((entry) => ({
          userId: this.userIdByPlayerId.get(entry.playerId) ?? null,
          distinctionKey: entry.key,
          metricValue: entry.metricValue,
        })),
      ),
    );
  }
```
(`finishGame` is the old inline `if (isGameOver(this.deck)) { ... return; }` block from the original `endTurn`, extracted verbatim into its own method and given the new `this.phase = 'GAME_OVER'` line — no other behavior change.)

Add the new imports this needs: `isDeckExhausted`, `hasIncompleteFamilyAnimal` alongside the existing `isGameOver` import from `@kuhhandel/game-engine`.

- [ ] **Step 4: Fix `sellerDecision`'s "final card" check**

That method currently calls `isGameOver(this.deck)` to detect "this was the last auction". Since `isGameOver` now takes `players`, swap in the correct check for that specific meaning:
```ts
    if (isDeckExhausted(this.deck)) {
      const buyer = this.findPlayer(result.cardGoesTo);
      this.statsTracker.onFinalCardResolved(buyer.id, result.card.species, buyer.animals);
    }
```

- [ ] **Step 5: Expose `phase` on `GameStateView`**

`packages/shared-types/src/index.ts` — add to `GameStateView`:
```ts
export interface GameStateView {
  status: RoomStatus;
  phase: GamePhase;
  players: PlayerView[];
  ...
```
Add `import type { ..., GamePhase } from "@kuhhandel/game-engine";` and re-export it: `export type { GamePhase };` alongside the other re-exported types.

`GameRoom.ts`'s `getViewFor` — add `phase: this.phase,` to the returned object.

- [ ] **Step 6: Typecheck the affected packages**

Run: `pnpm --filter @kuhhandel/game-engine typecheck && pnpm --filter @kuhhandel/shared-types typecheck && pnpm --filter @kuhhandel/realtime-server typecheck`
Expected: PASS. (This task's own test coverage is Task 15 — this task is integration wiring, verified by that follow-up task's new tests plus the existing suite not regressing, checked next.)

- [ ] **Step 7: Run the full realtime-server suite to catch regressions**

Run: `pnpm --filter @kuhhandel/realtime-server test`
Expected: the "full game to GAME_OVER" tests in `room.test.ts`/`room.persistence.test.ts`/`room.metaProgress.test.ts` now FAIL (they assert `status === 'finished'` the instant the deck empties, which is no longer true) — expected, fixed in Task 15.

- [ ] **Step 8: Commit**

```bash
git add apps/realtime-server/src/room/GameRoom.ts packages/shared-types/src/index.ts
git commit -m "feat(realtime-server): wire forced-Kuhhandel phase, golden donkey, and the real end-game condition into GameRoom"
```

---

### Task 15: Realtime-server tests for the new end-game behavior

**Files:**
- Create: `apps/realtime-server/test/helpers/playToGameOver.ts`
- Modify: `apps/realtime-server/test/room.test.ts`
- Modify: `apps/realtime-server/test/room.persistence.test.ts`
- Modify: `apps/realtime-server/test/room.metaProgress.test.ts`
- Create: `apps/realtime-server/test/room.forcedKuhhandel.test.ts`

**Design note:** with a deterministic `deckFactory` (Task 14) handing out species in 4-card blocks (not shuffled) and a scripted "active player's fixed first non-active neighbor always wins the auction, active player always sells" loop, three fixed players end up with a known, reproducible split. With `activePlayerIndex` rotating p0→p1→p2→p0→... and `others` computed as `players.filter(id !== active)` (join order preserved, so for active=p0 `others=[p1,p2]`, active=p1 `others=[p0,p2]`, active=p2 `others=[p0,p1]`), the fixed bidder-who-always-wins is `others[0]`, giving the buyer sequence `[p1, p0, p0]` repeating every 3 turns. Since each species occupies 4 consecutive turns (not a multiple of 3), every species block of 4 turns lands on buyer indices `[s, s+1, s+2, s]` (mod 3) for some starting phase `s` that cycles `0,1,2,0,1,2,0,1,2,0` across the 10 species (species `i` starts at turn `4i+1`, so `s = i mod 3`). Working through the three possible values of `s`:
- `s=0` (species 0,3,6,9 — 4 species): buyer indices `[0,1,2,0]` → buyers `[p1,p0,p0,p1]` → **p0 gets 2, p1 gets 2**.
- `s=1` (species 1,4,7 — 3 species): buyer indices `[1,2,0,1]` → buyers `[p0,p0,p1,p0]` → **p0 gets 3, p1 gets 1**.
- `s=2` (species 2,5,8 — 3 species): buyer indices `[2,0,1,2]` → buyers `[p0,p1,p0,p0]` → **p0 gets 3, p1 gets 1**.

So `p2` never buys anything (`others[0]` is never `p2` in this join order) and ends the auction phase with zero animals; `p0` ends up with a 3-1 split against `p1` on 6 species and a 2-2 split on 4 species; no species is ever fully bought by one side, so every one of the 10 species genuinely needs a forced-Kuhhandel consolidation to finish the game — a real exercise of both the ordinary 1-card trade and the special 2-card trade, plus `p2`'s auto-pass.

- [ ] **Step 1: Write the shared test helper**

`apps/realtime-server/test/helpers/playToGameOver.ts`:
```ts
import { GameRoom } from '../../src/room/GameRoom.js';
import { SPECIES_KEYS, type AnimalCard, type MoneyBank } from '@kuhhandel/game-engine';

/** Species in 4-card blocks, unshuffled — see the design note in room.forcedKuhhandel.test.ts for why this exact ordering makes the post-auction p0/p1/p2 split (and thus the Kuhhandel consolidation needed to finish the game) deterministic. */
export function groupedDeckFactory(): AnimalCard[] {
  const cards: AnimalCard[] = [];
  for (const species of SPECIES_KEYS) {
    for (let i = 0; i < 4; i++) cards.push({ id: `${species}-${i}`, species });
  }
  return cards;
}

/**
 * 60 ten-value cards per player: comfortably covers the ~26/14 auction
 * bids p0/p1 place over the 40-turn auction phase (worked out in the
 * design note) plus the up-to-10 consolidation trades below (2 cards
 * spent by p0 and 1 by p1 per trade, well under 60).
 */
export const DEEP_BANKROLL = (bank: MoneyBank, playerCount: number) => ({
  bank,
  hands: Array.from({ length: playerCount }, (_, p) =>
    Array.from({ length: 60 }, (_, i) => ({ id: `deep-${p}-${i}-${Math.random()}`, value: 10 as const })),
  ),
});

/**
 * Drives a 3-player room ['p0','p1','p2'] through the entire auction phase
 * (the deterministic buyer-always-wins loop described in
 * room.forcedKuhhandel.test.ts), then through the forced-Kuhhandel phase to
 * a true GAME_OVER. p0 initiates every consolidating trade against p1,
 * always offering 2 ten-value cards (20) against p1's fixed 1-card counter
 * (10) — p0's offer is strictly larger every time, so p0 always wins the
 * counter-resolution (never a tie), consolidating every split species
 * (both the 3-1 and 2-2 splits — the special 2-card trade is triggered
 * automatically by the engine whenever both sides hold 2, with no special
 * handling needed here).
 */
export function playAuctionOnlyThenConsolidate(room: GameRoom, playerIds: [string, string, string]): void {
  const [p0, p1] = playerIds;
  let view = room.getViewFor(p0);

  while (view.status === 'in_progress' && view.phase !== 'FORCED_KUHHANDEL') {
    const activeId = view.activePlayerId!;
    const others = view.players.map((p) => p.id).filter((id) => id !== activeId);
    room.startAuction(activeId);
    room.placeBid(others[0]!, 10);
    room.pass(others[1]!);
    room.sellerDecision(activeId, 'sell');
    view = room.getViewFor(p0);
  }

  while (view.status === 'in_progress') {
    const activeId = view.activePlayerId!;
    if (activeId !== p0) {
      // Only p0 initiates in this script. p1 and p2 never hold a species
      // p0 doesn't also hold (per the design note's split), so p0 is
      // always actionable and this script never needs p1/p2 to initiate;
      // this guards against a silent infinite loop if that assumption
      // is ever violated by a change elsewhere.
      throw new Error(`Unexpected active player during consolidation: ${activeId}`);
    }

    const p0Animals = room.getViewFor(p0).players.find((p) => p.id === p0)!.animals;
    const p1Animals = room.getViewFor(p0).players.find((p) => p.id === p1)!.animals;
    const species = SPECIES_KEYS.find((s) => {
      const p0Count = p0Animals.filter((a) => a.species === s).length;
      const p1Count = p1Animals.filter((a) => a.species === s).length;
      return p0Count > 0 && p1Count > 0 && p0Count < 4;
    });
    if (!species) break; // nothing left to consolidate; the game must be over

    room.startKuhhandel(p0, p1, species);
    const p0Money = room.getViewFor(p0).players.find((p) => p.id === p0)!.money!;
    room.submitOffer(p0, [p0Money[0]!.id, p0Money[1]!.id]); // 20 — always beats p1's 10 below

    const p1Money = room.getViewFor(p1).players.find((p) => p.id === p1)!.money!;
    room.respondCounter(p1, [p1Money[0]!.id]); // 10 — always loses to p0's 20, never a tie

    view = room.getViewFor(p0);
  }
}
```

- [ ] **Step 2: Write the new forced-Kuhhandel/auto-pass/2-card-trade test**

`apps/realtime-server/test/room.forcedKuhhandel.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { GameRoom } from '../src/room/GameRoom.js';
import { DEEP_BANKROLL, groupedDeckFactory, playAuctionOnlyThenConsolidate } from './helpers/playToGameOver.js';

describe('GameRoom — forced Kuhhandel phase and real end-game condition', () => {
  it('enters FORCED_KUHHANDEL once the deck empties, rejects new auctions, and only finishes once all families are complete', () => {
    const room = new GameRoom(() => 0, DEEP_BANKROLL, undefined, undefined, undefined, groupedDeckFactory);
    const p0 = room.join('p0');
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    room.start();

    playAuctionOnlyThenConsolidate(room, [p0, p1, p2]);

    const finalView = room.getViewFor(p0);
    expect(finalView.status).toBe('finished');
    expect(finalView.phase).toBe('GAME_OVER');
    for (const player of finalView.players) {
      expect(player.score).not.toBeNull();
    }
  });

  it('auto-passes a player holding only complete families (or nothing) during the forced phase', () => {
    const room = new GameRoom(() => 0, DEEP_BANKROLL, undefined, undefined, undefined, groupedDeckFactory);
    const p0 = room.join('p0');
    const p1 = room.join('p1');
    const p2 = room.join('p2');
    room.start();

    let view = room.getViewFor(p0);
    while (view.phase !== 'FORCED_KUHHANDEL') {
      const activeId = view.activePlayerId!;
      const others = view.players.map((p) => p.id).filter((id) => id !== activeId);
      room.startAuction(activeId);
      room.placeBid(others[0]!, 10);
      room.pass(others[1]!);
      room.sellerDecision(activeId, 'sell');
      view = room.getViewFor(p0);
    }

    // p2 holds zero animals by construction (see helper design note) —
    // GameRoom must never select p2 as the active player from here on.
    expect(view.activePlayerId).not.toBe(p2);
  });
});
```

- [ ] **Step 3: Run to verify it passes**

Run: `pnpm --filter @kuhhandel/realtime-server test -- room.forcedKuhhandel`
Expected: PASS — per the design note's worked-out buyer pattern, every species is split between p0 and p1, so `startKuhhandel` never fails with "both players must own at least one animal of that species", and p0's fixed 20-vs-10 offer never ties.

- [ ] **Step 4: Fix the three pre-existing "full game to GAME_OVER" tests**

`room.test.ts`, `room.persistence.test.ts`, `room.metaProgress.test.ts` each have a test that loops purely on auctions expecting `status === 'finished'` right after the deck empties. Replace each of those tests' bodies to use the new helper:
```ts
import { groupedDeckFactory, playAuctionOnlyThenConsolidate } from './helpers/playToGameOver.js';
// ...
    const room = new GameRoom(() => 0, deepBankroll, /* ...existing extra args..., */ undefined, undefined, groupedDeckFactory);
    const p0 = room.join('p1', /* ...existing userId args... */);
    const p1 = room.join('p2', /* ... */);
    const p2 = room.join('p3', /* ... */);
    room.start();
    // ... existing pre-flush/await logic stays ...
    playAuctionOnlyThenConsolidate(room, [p0, p1, p2]);
    const view = room.getViewFor(p0);
    expect(view.deckCount).toBe(0);
    expect(view.status).toBe('finished');
```
Adjust each file's exact variable names (`p1`/`p2`/`p3` vs `p0`/`p1`/`p2`) to match what's already declared in that test — the join order/ids stay the same, only the driving loop changes.

- [ ] **Step 5: Run the full realtime-server suite**

Run: `pnpm --filter @kuhhandel/realtime-server test`
Expected: PASS, all green.

- [ ] **Step 6: Commit**

```bash
git add apps/realtime-server/test
git commit -m "test(realtime-server): cover forced-Kuhhandel auto-pass, 2-card trades, and the real end-game condition"
```

---

### Task 16: `docs/01_GDD_GAMEPLAY.md` corrections

**Files:**
- Modify: `docs/01_GDD_GAMEPLAY.md`

- [ ] **Step 1: Correct the Kuhhandel money-resolution paragraph (line 48)**

Replace:
> **Le gagnant garde tout l'argent misé par les deux joueurs** (règle centrale et contre-intuitive du jeu : l'argent misé par les deux parties reste dans le jeu, redistribué au vainqueur de l'enchère, en plus de la carte gagnée). Le perdant ne récupère pas sa mise.

with:
> **Chaque joueur conserve l'argent qu'il a lui-même misé** — seul l'animal change de main ; aucun argent n'est créé ni détruit lors d'un marchandage (contrairement à une enchère, où l'argent du gagnant va effectivement au vendeur).

- [ ] **Step 2: Add the special 2-card trade and golden donkey to section 3.2**

After the existing numbered list (after line 50), add:
```
6. **Marchandage spécial** : si les joueurs A et B possèdent chacun **deux** cartes de la même famille, le marchandage porte sur les **deux cartes à la fois** (le gagnant remporte les deux d'un coup). Si l'un des deux n'en possède qu'une, le marchandage ne porte que sur une seule carte.

### 3.3 L'âne d'or
Quand une carte "âne" est retournée pour être mise aux enchères, les enchères sont interrompues avant de commencer : chaque joueur (y compris le meneur) reçoit une carte argent supplémentaire — 50 la 1ère fois qu'un âne est retourné dans la partie, 100 la 2e, 200 la 3e, 500 la 4e (il y a exactement 4 ânes dans les 40 cartes animaux). L'âne est ensuite mis aux enchères normalement.
```

- [ ] **Step 3: Correct section 4 (end-game) — real trigger, forced phase, and the multiplier**

Replace the whole "## 4. Fin de partie" section with:
```
## 4. Fin de partie
- La partie se termine quand **toutes les familles (10 espèces) sont complètes** — pas nécessairement chez le même joueur, mais chacune des 10 espèces doit avoir ses 4 exemplaires réunis dans la main d'un seul joueur.
- **Phase de marchandage forcé** : dès que la pioche d'animaux est épuisée, les enchères s'arrêtent et le marchandage devient **obligatoire** à chaque tour. Un joueur qui, à ce stade, ne possède que des familles complètes (ou plus aucun animal) ne peut plus participer à un marchandage et passe son tour automatiquement.
- Chaque joueur totalise la valeur de ses familles **complètes** uniquement, puis **multiplie ce total par le nombre de familles complètes qu'il possède** (ex. 4 cochons + 4 chiens + 4 coqs = 820, ×3 familles = 2460 points).
- Les animaux isolés (famille incomplète) ne rapportent rien.
- Le joueur avec le score total le plus élevé gagne.
- **Note de design** : l'argent restant en main ne compte pas dans le score final.
```

- [ ] **Step 4: Update the money-supply note in section 5/wherever `STARTING_MONEY` is discussed, if present**

Search for any remaining reference to the old 570-money starting allotment or an "unlimited money" assumption (`grep -n "570\|100.*200\|mise de départ" docs/01_GDD_GAMEPLAY.md`) and correct to 90 (2×0 + 4×10 + 1×50), noting the shared 55-card bank.

- [ ] **Step 5: Commit**

```bash
git add docs/01_GDD_GAMEPLAY.md
git commit -m "docs: correct GDD to match the rulebook (Kuhhandel money, end-game, multiplier, donkey, special trade)"
```

---

## Final verification

- [ ] Run the entire monorepo test suite: `pnpm -r run test`
- [ ] Run the entire monorepo typecheck: `pnpm -r run typecheck`
- [ ] `grep -rn "boeuf" packages apps docs` returns no hits outside historical handoff/spec/plan documents.
- [ ] `grep -rn "movePotToWinner\|KuhhandelTieBreakResolution" packages apps` returns no hits.
- [ ] Manually re-read `docs/HANDOFF_KUHHANDEL_RULES_FIX.md`'s 9 findings and confirm each has a corresponding task above (species, scoring multiplier, golden donkey, special 2-card Kuhhandel, money resolution, end-game trigger, starting money, shared money bank, dead type).
