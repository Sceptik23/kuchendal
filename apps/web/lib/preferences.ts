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
