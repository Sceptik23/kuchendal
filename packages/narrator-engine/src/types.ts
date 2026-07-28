/**
 * Selectable narrator styles (08_AI.md §1) — each is an independent pool of
 * templates keyed the same way, so adding a style never touches the
 * selection logic, only the catalog.
 */
export const NARRATOR_STYLES = ["sport", "documentary", "western", "tv"] as const;
export type NarratorStyle = (typeof NARRATOR_STYLES)[number];

/**
 * Events the narrator can comment on (08_AI.md §1): big bid, unmasked
 * bluff, bold Kuhhandel, and a standings reversal.
 */
export const NARRATOR_EVENT_KEYS = [
  "bigBid",
  "bluffRevealed",
  "boldKuhhandel",
  "comeback",
] as const;
export type NarratorEventKey = (typeof NARRATOR_EVENT_KEYS)[number];

export interface NarratorTemplate {
  /** Weight for the pseudo-random weighted pick — higher picks more often. */
  weight: number;
  /** `{placeholder}` tokens filled in from the event's context at selection time. */
  text: string;
}

export type NarratorTemplateCatalog = Record<
  NarratorStyle,
  Record<NarratorEventKey, NarratorTemplate[]>
>;

export type NarratorPlaceholders = Record<string, string | number>;

export interface NarratorMessage {
  style: NarratorStyle;
  eventKey: NarratorEventKey;
  text: string;
}

/**
 * Isolation point called out in 08_AI.md §1: v1 is template-based, but a
 * future generative provider (LLM call, offline-authored) can implement
 * this same interface without touching any call site.
 */
export interface NarratorProvider {
  comment(
    style: NarratorStyle,
    eventKey: NarratorEventKey,
    placeholders: NarratorPlaceholders,
  ): NarratorMessage | null;
}
