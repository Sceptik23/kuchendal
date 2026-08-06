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

/**
 * For bidding: greedily composes the largest sum from `hand` that is
 * `<= maxAmount`, and returns it only if that sum exceeds `minAmount`
 * (a valid strictly-higher raise) — otherwise `null` (no raise possible
 * within budget). Bids don't need an exact target, unlike a "keep"
 * payment (see `selectExactCards`).
 */
export function selectCardsExceeding(
  hand: MoneyCard[],
  minAmount: number,
  maxAmount: number,
): MoneyCard[] | null {
  const sorted = [...hand].filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
  const selected: MoneyCard[] = [];
  let sum = 0;
  for (const card of sorted) {
    if (sum + card.value <= maxAmount) {
      selected.push(card);
      sum += card.value;
    }
  }
  return sum > minAmount ? selected : null;
}

/**
 * For a "keep" payment: finds a subset of `hand` summing to *exactly*
 * `exactAmount` (no change-making). Bounded recursive search — a
 * player's hand is always small (drawn from the shared 55-card bank), so
 * this is cheap despite the worst-case exponential shape.
 */
export function selectExactCards(hand: MoneyCard[], exactAmount: number): MoneyCard[] | null {
  const positive = hand.filter((c) => c.value > 0);

  function search(index: number, remaining: number): MoneyCard[] | null {
    if (remaining === 0) return [];
    if (remaining < 0 || index >= positive.length) return null;
    const withCard = search(index + 1, remaining - positive[index]!.value);
    if (withCard) return [positive[index]!, ...withCard];
    return search(index + 1, remaining);
  }

  if (exactAmount === 0) return [];
  return search(0, exactAmount);
}
