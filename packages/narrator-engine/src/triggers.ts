/**
 * Trigger thresholds, kept as plain configurable numbers rather than
 * magic constants scattered across call sites (mirrors the "bluff"
 * definition rule in 08_AI.md §4: fixed in config, not left to a prompt).
 */
export const NARRATOR_TRIGGERS_CONFIG = {
  /** An auction bid at or above this amount is commentary-worthy. */
  bigBidThreshold: 300,
  /** Share of cash-before-offer that counts as an "all-in" bold Kuhhandel. */
  boldKuhhandelOfferShare: 0.7,
};

export function isBigBid(amount: number): boolean {
  return amount >= NARRATOR_TRIGGERS_CONFIG.bigBidThreshold;
}

/**
 * A "bluff" per 08_AI.md §4 MVP definition: the Kuhhandel winner staked
 * less than the losing side did.
 */
export function isBluffRevealed(winnerStake: number, loserStake: number): boolean {
  return winnerStake < loserStake;
}

export function isBoldKuhhandelOffer(offerTotal: number, cashBeforeOffer: number): boolean {
  if (cashBeforeOffer <= 0) return false;
  return offerTotal / cashBeforeOffer >= NARRATOR_TRIGGERS_CONFIG.boldKuhhandelOfferShare;
}

/** A mid-game standings reversal: the player in the lead has changed. */
export function isComeback(previousLeaderId: string | null, newLeaderId: string): boolean {
  return previousLeaderId !== null && previousLeaderId !== newLeaderId;
}
