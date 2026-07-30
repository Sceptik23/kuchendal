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
 * bank still has stock of, one card at a time. If literally every
 * denomination is exhausted it mints a fresh value-`0` card as a last
 * resort — a "0" is the lowest-stakes possible substitute (the rulebook's
 * own framing is that 0 cards exist only to bluff with), so degrading this
 * way cannot inflate the money supply in any meaningful sense.
 *
 * This function NEVER throws, under any circumstances, at any player count
 * or number of donkey reveals. That guarantee is load-bearing: both
 * `dealStartingMoney` and `distributeGoldenDonkeyBonus` draw from this
 * shared 55-card bank, and their callers mutate room state before drawing
 * — a throw here would leave a realtime room permanently wedged. A
 * physical banker gives change up (or hands over a worthless slip) rather
 * than halting play. See the design spec's "Open questions".
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
      // Bank fully exhausted across every denomination: degrade gracefully by
      // minting a worthless value-0 card rather than throwing. `counts` stays
      // at zero (nothing real was withdrawn); only `nextId` advances so card
      // ids remain unique.
      cards.push({ id: `bank-money-${currentBank.nextId}`, value: 0 });
      currentBank = { counts: currentBank.counts, nextId: currentBank.nextId + 1 };
      continue;
    }
    const drawn = drawFromBank(currentBank, candidateDenomination, 1);
    currentBank = drawn.bank;
    cards.push(drawn.cards[0]!);
  }

  return { bank: currentBank, cards };
}
