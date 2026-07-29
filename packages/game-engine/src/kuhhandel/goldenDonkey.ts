import { drawFromBankWithFallback, type MoneyBank } from '../money/moneyBank.js';
import type { AnimalCard, Player } from '../types.js';

/**
 * L'âne d'or (rulebook): the 1st âne revealed pays every player 50, the
 * 2nd 100, the 3rd 200, the 4th 500 — there are exactly 4 ânes in the
 * 40-card deck, so `donkeyRevealCount` (0-indexed, tracked per game) never
 * legitimately exceeds 3.
 */
export const DONKEY_BONUS_SEQUENCE = [50, 100, 200, 500] as const;

export function isGoldenDonkeyCard(card: AnimalCard): boolean {
  return card.species === 'ane';
}

export function distributeGoldenDonkeyBonus(
  bank: MoneyBank,
  players: Player[],
  donkeyRevealCount: number,
): { bank: MoneyBank; players: Player[] } {
  const index = Math.min(donkeyRevealCount, DONKEY_BONUS_SEQUENCE.length - 1);
  const amount = DONKEY_BONUS_SEQUENCE[index];

  let currentBank = bank;
  const updatedPlayers: Player[] = [];
  for (const player of players) {
    const { bank: nextBank, cards } = drawFromBankWithFallback(currentBank, amount, 1);
    currentBank = nextBank;
    updatedPlayers.push({ ...player, money: [...player.money, ...cards] });
  }

  return { bank: currentBank, players: updatedPlayers };
}
