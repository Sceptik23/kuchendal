/**
 * Bot difficulty presets (08_AI.md §2): numeric knobs only, no trained
 * model — "aggressivité" scales how much of its estimate a bot is willing
 * to bid/offer, "tolerance au risque" adds bounded randomness so the bot
 * isn't perfectly predictable.
 */
export type BotDifficulty = "easy" | "normal";

export interface BotConfig {
  /** Share of the estimated card/species value the bot is comfortable bidding up to. */
  aggressiveness: number;
  /** +/- random variance applied on top of a computed amount, as a share of that amount. */
  riskTolerance: number;
}

export const BOT_DIFFICULTY_PRESETS: Record<BotDifficulty, BotConfig> = {
  easy: { aggressiveness: 0.35, riskTolerance: 0.1 },
  normal: { aggressiveness: 0.55, riskTolerance: 0.2 },
};
