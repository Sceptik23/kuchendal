import { MONEY_DENOMINATIONS, STARTING_MONEY, type MoneyDenomination } from '../config/money.config.js';
import { drawFromBankWithFallback, type MoneyBank } from '../money/moneyBank.js';
import type { MoneyCard } from '../types.js';

/**
 * Deals every player's starting hand from the same shared bank, so the
 * total money handed out is bounded by the bank's real supply (cf.
 * moneyBank.ts).
 *
 * Dealing is ROUND-ROBIN by denomination — one card to every player in
 * turn, then the next round — exactly like a physical dealer, rather than
 * completing one player's whole hand before starting the next. This
 * matters at 6 players (beyond the rulebook's stated 3-5): 6 players need
 * 12×"0" and 24×"10" but the box only holds 10 and 20 respectively, so
 * some substitution is structurally unavoidable. Sequential dealing
 * dumped the ENTIRE shortfall on the last player, who ended up with ~450
 * instead of 90 and an unfair cash advantage for the whole game.
 * Round-robin instead spreads it: only the players dealt last within the
 * one round that runs short receive a substituted (higher) denomination,
 * so every hand stays within one card's value of every other.
 *
 * `drawFromBankWithFallback` never throws, so this function never throws
 * at any player count.
 */
export function dealStartingMoney(
  bank: MoneyBank,
  playerCount: number,
): { bank: MoneyBank; hands: MoneyCard[][] } {
  let currentBank = bank;
  const hands: MoneyCard[][] = Array.from({ length: playerCount }, () => []);

  for (const denomination of MONEY_DENOMINATIONS) {
    const count = STARTING_MONEY[denomination as MoneyDenomination];
    for (let round = 0; round < count; round++) {
      for (let p = 0; p < playerCount; p++) {
        const { bank: nextBank, cards } = drawFromBankWithFallback(currentBank, denomination, 1);
        currentBank = nextBank;
        hands[p]!.push(...cards);
      }
    }
  }

  return { bank: currentBank, hands };
}
