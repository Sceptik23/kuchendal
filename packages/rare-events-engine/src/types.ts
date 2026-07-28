/**
 * A rare in-game event (07_META_GAME.md §6 / 06_AUDIO_VFX.md §4): purely
 * cosmetic flavor, never touches scoring or game rules. `vfx` and `sound`
 * are stable identifiers the client maps to an animation/audio asset —
 * this package only owns the catalog and the trigger roll, never the
 * actual asset files.
 */
export interface RareEventEntry {
  key: string;
  name: string;
  flavorText: string;
  vfx: string;
  sound: string;
  /** Relative weight for the pseudo-random pick among triggered events. */
  weight: number;
}
