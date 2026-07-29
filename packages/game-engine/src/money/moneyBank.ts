import { MONEY_DENOMINATIONS, type MoneyDenomination } from '../config/money.config.js';
import type { MoneyCard } from '../types.js';

/**
 * Models the rulebook's finite 55-card money supply (10×0, 20×10, 10×50,
 * 5×100, 5×200, 5×500). Every card the game ever hands to a player —
 * starting hands, golden donkey bonuses — is minted from here, so the
 * total money in the game can never exceed what a physical box contains.
 */
export interface MoneyBank {
  counts: Record<MoneyDenomination, number>;
  nextId: number;
}

export function createMoneyBank(): MoneyBank {
  return {
    counts: { 0: 10, 10: 20, 50: 10, 100: 5, 200: 5, 500: 5 },
    nextId: 0,
  };
}

export function drawFromBank(
  bank: MoneyBank,
  denomination: MoneyDenomination,
  count: number,
): { bank: MoneyBank; cards: MoneyCard[] } {
  const available = bank.counts[denomination];
  if (available < count) {
    throw new Error(
      `Money bank has only ${available} card(s) of denomination ${denomination}, requested ${count}.`,
    );
  }

  const cards: MoneyCard[] = [];
  let nextId = bank.nextId;
  for (let i = 0; i < count; i++) {
    cards.push({ id: `bank-money-${nextId++}`, value: denomination });
  }

  return {
    bank: {
      counts: { ...bank.counts, [denomination]: available - count },
      nextId,
    },
    cards,
  };
}

/**
 * Draws `count` cards as close to `denomination` as the bank can manage:
 * exact match first, then escalating to the next larger denomination the
 * bank still has stock of, one card at a time. Never throws — a physical
 * banker would give change up rather than halt play, and this keeps the
 * golden donkey bonus and (at 6 players, beyond the rulebook's stated 3-5)
 * starting-money deal from ever blocking a game. See moneyBank docs / the
 * design spec's "Open questions" for why this fallback exists.
 */
export function drawFromBankWithFallback(
  bank: MoneyBank,
  denomination: MoneyDenomination,
  count: number,
): { bank: MoneyBank; cards: MoneyCard[] } {
  let currentBank = bank;
  const cards: MoneyCard[] = [];

  for (let i = 0; i < count; i++) {
    const startIndex = MONEY_DENOMINATIONS.indexOf(denomination);
    const candidateDenomination = MONEY_DENOMINATIONS.slice(startIndex).find(
      (d) => currentBank.counts[d] > 0,
    );
    if (candidateDenomination === undefined) {
      throw new Error('Money bank is completely exhausted across every denomination.');
    }
    const drawn = drawFromBank(currentBank, candidateDenomination, 1);
    currentBank = drawn.bank;
    cards.push(drawn.cards[0]!);
  }

  return { bank: currentBank, cards };
}
