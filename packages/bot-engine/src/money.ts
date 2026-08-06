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
 * For bidding: finds the maximum achievable sum from `hand` that is
 * `<= maxAmount`, and returns it only if that sum exceeds `minAmount`
 * (a valid strictly-higher raise) — otherwise `null` (no raise possible
 * within budget). Exhaustive search to avoid greedy failures (e.g., taking
 * the largest card first can miss better combinations). Bids don't need an
 * exact target, unlike a "keep" payment (see `selectExactCards`).
 *
 * A candidate is only ever recorded when it actually selects at least one
 * card (`chosen.length > 0`). Without this, the empty selection (sum 0) can
 * itself satisfy `sum > minAmount` whenever `minAmount < 0` — i.e. whenever
 * there is no existing highest bid — which would make this return `[]`
 * (a truthy, "bid nothing" result) instead of `null` (pass) when no single
 * card fits within `maxAmount`.
 *
 * Memoized on `(index, sum)`: the reachable state space is bounded by
 * `positive.length * (maxAmount + 1)` rather than `2^positive.length`, which
 * matters because this runs synchronously inside a socket handler and a
 * slow call blocks every room on the server, not just one player. Late-game
 * hands can hold 25-30 money cards, where the naive unmemoized search would
 * be exponential.
 */
export function selectCardsExceeding(
  hand: MoneyCard[],
  minAmount: number,
  maxAmount: number,
): MoneyCard[] | null {
  const positive = hand.filter((c) => c.value > 0);
  let best: MoneyCard[] | null = null;
  let bestSum = -Infinity;
  const memo = new Map<string, true>();

  function search(index: number, chosen: MoneyCard[], sum: number): void {
    if (chosen.length > 0 && sum > minAmount && sum > bestSum) {
      bestSum = sum;
      best = chosen;
    }
    if (index >= positive.length || sum >= maxAmount) return;

    const key = `${index}:${sum}`;
    if (memo.has(key)) return;
    memo.set(key, true);

    const card = positive[index]!;
    if (sum + card.value <= maxAmount) {
      search(index + 1, [...chosen, card], sum + card.value);
    }
    search(index + 1, chosen, sum);
  }

  search(0, [], 0);
  return best;
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
