import { STARTING_MONEY } from '../config/money.config.js';
import type { MoneyCard } from '../types.js';

let cardCounter = 0;

export function createStartingMoney(): MoneyCard[] {
  const hand: MoneyCard[] = [];
  for (const [value, count] of Object.entries(STARTING_MONEY)) {
    for (let i = 0; i < count; i++) {
      hand.push({ id: `money-${cardCounter++}`, value: Number(value) as MoneyCard['value'] });
    }
  }
  return hand;
}
