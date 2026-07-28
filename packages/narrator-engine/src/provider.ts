import type { RandomSource } from "@kuhhandel/game-engine";
import { NARRATOR_TEMPLATES } from "./config/templates.config.js";
import type {
  NarratorEventKey,
  NarratorMessage,
  NarratorPlaceholders,
  NarratorProvider,
  NarratorStyle,
  NarratorTemplate,
  NarratorTemplateCatalog,
} from "./types.js";

function fillPlaceholders(text: string, placeholders: NarratorPlaceholders): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in placeholders ? String(placeholders[key]) : match,
  );
}

/** Pseudo-random weighted pick (08_AI.md §1: "sélection pseudo-aléatoire pondérée"). */
export function pickWeighted<T extends { weight: number }>(pool: T[], rng: RandomSource): T | null {
  if (pool.length === 0) return null;
  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * totalWeight;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return pool[pool.length - 1]!;
}

export class TemplateNarratorProvider implements NarratorProvider {
  constructor(
    private readonly rng: RandomSource = Math.random,
    private readonly catalog: NarratorTemplateCatalog = NARRATOR_TEMPLATES,
  ) {}

  comment(
    style: NarratorStyle,
    eventKey: NarratorEventKey,
    placeholders: NarratorPlaceholders,
  ): NarratorMessage | null {
    const pool: NarratorTemplate[] = this.catalog[style][eventKey];
    const template = pickWeighted(pool, this.rng);
    if (!template) return null;
    return { style, eventKey, text: fillPlaceholders(template.text, placeholders) };
  }
}
