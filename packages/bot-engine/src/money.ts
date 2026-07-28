import type { MoneyCard } from "@kuhhandel/game-engine";

export function totalValue(cards: MoneyCard[]): number {
  return cards.reduce((sum, c) => sum + c.value, 0);
}

/**
 * Greedily picks cards from `hand` that sum as close as possible to
 * `targetAmount` without exceeding the hand's total. Used by the bot to
 * compose a bid amount or a secret Kuhhandel offer out of fixed
 * denominations (10/50/100/200/500, plus 0-value bluff cards) rather than
 * an arbitrary number a real player could type.
 */
export function selectCardsForAmount(hand: MoneyCard[], targetAmount: number): MoneyCard[] {
  const sorted = [...hand].sort((a, b) => b.value - a.value);
  const selected: MoneyCard[] = [];
  let remaining = Math.max(0, targetAmount);

  for (const card of sorted) {
    if (card.value === 0) continue;
    if (card.value <= remaining) {
      selected.push(card);
      remaining -= card.value;
    }
  }

  if (selected.length === 0) {
    const smallest = sorted.filter((c) => c.value > 0).at(-1);
    if (smallest) selected.push(smallest);
  }

  return selected;
}
