import type { AuctionResult } from '../auction/auction.js';
import type { KuhhandelResult } from '../kuhhandel/kuhhandel.js';
import type { AnimalCard, MoneyCard, Player } from '../types.js';

function findPlayer(players: Player[], id: string): Player {
  const player = players.find((p) => p.id === id);
  if (!player) throw new Error(`Unknown player: ${id}`);
  return player;
}

function replacePlayer(players: Player[], updated: Player): Player[] {
  return players.map((p) => (p.id === updated.id ? updated : p));
}

/**
 * Moves a single money card of the exact given amount from payer to payee.
 * Simplification (Phase 1 scope): the engine does not simulate making
 * change for bids that don't match an exact denomination in hand — real
 * gameplay requires the payer to compose the amount from their cards,
 * which is a player/UI concern, not a core rule enforced here.
 */
function transferExactMoneyCard(
  players: Player[],
  fromId: string,
  toId: string,
  amount: number,
): Player[] {
  const payer = findPlayer(players, fromId);
  const payee = findPlayer(players, toId);
  const cardIndex = payer.money.findIndex((card) => card.value === amount);
  if (cardIndex === -1) {
    throw new Error(
      `Player ${fromId} has no single card worth exactly ${amount} to complete this payment.`,
    );
  }
  const card = payer.money[cardIndex]!;

  let next = replacePlayer(players, {
    ...payer,
    money: payer.money.filter((_, i) => i !== cardIndex),
  });
  next = replacePlayer(next, { ...payee, money: [...payee.money, card] });
  return next;
}

function transferMoneyCards(
  players: Player[],
  fromId: string,
  toId: string,
  cards: MoneyCard[],
): Player[] {
  const cardIds = new Set(cards.map((c) => c.id));
  const payer = findPlayer(players, fromId);
  const payee = findPlayer(players, toId);

  let next = replacePlayer(players, {
    ...payer,
    money: payer.money.filter((c) => !cardIds.has(c.id)),
  });
  next = replacePlayer(next, { ...findPlayer(next, toId), money: [...payee.money, ...cards] });
  return next;
}

/**
 * Removes every card whose id appears in `cards` from every player's hand
 * (regardless of who currently holds it), then gives all of them to the
 * winner. Used for Kuhhandel counter-offer resolution: both the winner's
 * and loser's staked cards must leave their respective hands before the
 * whole pot is handed to the winner (cf. GDD §3.2.4).
 */
function movePotToWinner(players: Player[], winnerId: string, potMoney: MoneyCard[]): Player[] {
  const potIds = new Set(potMoney.map((c) => c.id));
  const withoutPot = players.map((p) => ({
    ...p,
    money: p.money.filter((c) => !potIds.has(c.id)),
  }));
  const winner = findPlayer(withoutPot, winnerId);
  return replacePlayer(withoutPot, { ...winner, money: [...winner.money, ...potMoney] });
}

function transferAnimalCard(players: Player[], toId: string, card: AnimalCard): Player[] {
  const payee = findPlayer(players, toId);
  return replacePlayer(players, { ...payee, animals: [...payee.animals, card] });
}

function removeAnimalOfSpecies(
  players: Player[],
  fromId: string,
  species: AnimalCard['species'],
): { players: Player[]; card: AnimalCard } {
  const owner = findPlayer(players, fromId);
  const index = owner.animals.findIndex((a) => a.species === species);
  if (index === -1) {
    throw new Error(`Player ${fromId} does not own any ${species} to transfer.`);
  }
  const card = owner.animals[index]!;
  const next = replacePlayer(players, {
    ...owner,
    animals: owner.animals.filter((_, i) => i !== index),
  });
  return { players: next, card };
}

export function applyAuctionResult(players: Player[], result: AuctionResult): Player[] {
  let next = transferAnimalCard(players, result.cardGoesTo, result.card);
  if (result.payment) {
    next = transferExactMoneyCard(
      next,
      result.payment.from,
      result.payment.to,
      result.payment.amount,
    );
  }
  return next;
}

export function applyKuhhandelResult(players: Player[], result: KuhhandelResult): Player[] {
  if (result.type === 'accept') {
    let next = transferMoneyCards(players, result.moneyFrom, result.moneyGoesTo, result.money);
    const { players: afterRemoval, card } = removeAnimalOfSpecies(
      next,
      result.cardComesFrom,
      result.species,
    );
    next = transferAnimalCard(afterRemoval, result.cardGoesTo, card);
    return next;
  }

  if (result.type === 'tie_reoffer_needed') {
    return players;
  }

  // counter_resolved / tie_default_initiator_wins: winner takes the pot and the loser's animal.
  const { players: afterRemoval, card } = removeAnimalOfSpecies(
    players,
    result.loserId,
    result.species,
  );
  let next = transferAnimalCard(afterRemoval, result.winnerId, card);
  next = movePotToWinner(next, result.winnerId, result.potMoney);
  return next;
}
