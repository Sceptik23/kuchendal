/**
 * Best-effort cosmetic sound playback (06_AUDIO_VFX.md). Actual audio
 * assets are a content follow-up (same as the badge/title catalogs) — if
 * `/sounds/<key>.mp3` doesn't exist yet or autoplay is blocked, this is a
 * silent no-op, never something the game depends on to be understandable.
 */
export function playSound(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio(`/sounds/${key}.mp3`);
    audio.volume = 0.5;
    void audio.play().catch(() => {
      // Missing asset or blocked autoplay — safe to ignore.
    });
  } catch {
    // Audio unsupported in this environment — safe to ignore.
  }
}
