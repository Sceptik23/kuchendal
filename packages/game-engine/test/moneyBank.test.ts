import { describe, expect, it } from 'vitest';
import { MONEY_DENOMINATIONS } from '../src/config/money.config.js';
import {
  createMoneyBank,
  drawFromBank,
  drawFromBankWithFallback,
} from '../src/money/moneyBank.js';

describe('createMoneyBank', () => {
  it("starts with the rulebook's 55-card supply", () => {
    const bank = createMoneyBank();
    expect(bank.counts).toEqual({ 0: 10, 10: 20, 50: 10, 100: 5, 200: 5, 500: 5 });
  });
});

describe('drawFromBank', () => {
  it('mints the requested cards and decrements the bank', () => {
    const bank = createMoneyBank();
    const { bank: next, cards } = drawFromBank(bank, 50, 3);

    expect(cards).toHaveLength(3);
    expect(cards.every((c) => c.value === 50)).toBe(true);
    expect(new Set(cards.map((c) => c.id)).size).toBe(3);
    expect(next.counts[50]).toBe(7);
    expect(bank.counts[50]).toBe(10); // original bank is untouched (pure)
  });

  it('throws when the bank does not have enough of that denomination', () => {
    const bank = createMoneyBank();
    expect(() => drawFromBank(bank, 500, 6)).toThrow(/500/);
  });
});

describe('drawFromBankWithFallback', () => {
  it('behaves like drawFromBank when supply is sufficient', () => {
    const bank = createMoneyBank();
    const { bank: next, cards } = drawFromBankWithFallback(bank, 10, 5);

    expect(cards.every((c) => c.value === 10)).toBe(true);
    expect(next.counts[10]).toBe(15);
  });

  it('escalates to the next larger available denomination when exhausted', () => {
    let bank = createMoneyBank();
    bank = drawFromBank(bank, 0, 10).bank; // exhaust all ten "0" cards

    const { bank: next, cards } = drawFromBankWithFallback(bank, 0, 2);

    expect(cards).toHaveLength(2);
    expect(cards.every((c) => c.value === 10)).toBe(true); // next denomination up
    expect(next.counts[10]).toBe(18);
  });

  it('falls back to the largest remaining denomination when only 500s are left', () => {
    let bank = createMoneyBank();
    for (const denom of [0, 10, 50, 100, 200] as const) {
      bank = drawFromBank(bank, denom, bank.counts[denom]).bank;
    }
    bank = drawFromBank(bank, 500, 3).bank; // leave exactly two 500s left

    const { cards } = drawFromBankWithFallback(bank, 0, 2);
    expect(cards).toHaveLength(2);
    expect(cards.every((c) => c.value === 500)).toBe(true);
  });

  it('never throws even if every denomination is exhausted', () => {
    let bank = createMoneyBank();
    for (const denom of MONEY_DENOMINATIONS) {
      bank = drawFromBank(bank, denom, bank.counts[denom]).bank;
    }
    // The bank is now genuinely empty across all six denominations.
    expect(Object.values(bank.counts).every((n) => n === 0)).toBe(true);

    const { bank: next, cards } = drawFromBankWithFallback(bank, 500, 3);

    expect(cards).toHaveLength(3);
    expect(cards.every((c) => c.value === 0)).toBe(true); // minted worthless fallback
    expect(new Set(cards.map((c) => c.id)).size).toBe(3); // ids still unique
    expect(Object.values(next.counts).every((n) => n === 0)).toBe(true); // no real supply consumed
    expect(next.nextId).toBe(bank.nextId + 3);
  });

  it('mints unique ids when it crosses from real supply into the empty fallback', () => {
    let bank = createMoneyBank();
    for (const denom of [0, 10, 50, 100, 200] as const) {
      bank = drawFromBank(bank, denom, bank.counts[denom]).bank;
    }
    bank = drawFromBank(bank, 500, 4).bank; // exactly one 500 left

    const { cards } = drawFromBankWithFallback(bank, 0, 3);
    expect(cards.map((c) => c.value)).toEqual([500, 0, 0]);
    expect(new Set(cards.map((c) => c.id)).size).toBe(3);
  });
});
