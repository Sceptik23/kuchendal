import { MONEY_DENOMINATIONS, STARTING_MONEY, type MoneyDenomination } from '../config/money.config.js';
import { drawFromBankWithFallback, type MoneyBank } from '../money/moneyBank.js';
import type { MoneyCard } from '../types.js';

/**
 * Deals every player's starting hand from the same shared bank, in one
 * pass, so the total money handed out is bounded by the bank's real
 * supply (cf. moneyBank.ts). At 6 players (beyond the rulebook's stated
 * 3-5) the "0" and "10" denominations run out mid-deal; the fallback
 * escalates to the next available denomination rather than blocking the
 * game — see the design spec's "Open questions".
 */
export function dealStartingMoney(
  bank: MoneyBank,
  playerCount: number,
): { bank: MoneyBank; hands: MoneyCard[][] } {
  let currentBank = bank;
  const hands: MoneyCard[][] = [];

  for (let i = 0; i < playerCount; i++) {
    const hand: MoneyCard[] = [];
    for (const denomination of MONEY_DENOMINATIONS) {
      const count = STARTING_MONEY[denomination as MoneyDenomination];
      if (count === 0) continue;
      const { bank: nextBank, cards } = drawFromBankWithFallback(currentBank, denomination, count);
      currentBank = nextBank;
      hand.push(...cards);
    }
    hands.push(hand);
  }

  return { bank: currentBank, hands };
}
