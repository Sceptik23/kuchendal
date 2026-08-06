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


function removeAnimalsOfSpecies(
  players: Player[],
  fromId: string,
  species: AnimalCard['species'],
  count: number,
): { players: Player[]; cards: AnimalCard[] } {
  const owner = findPlayer(players, fromId);
  const removed: AnimalCard[] = [];
  let remaining = [...owner.animals];
  for (let i = 0; i < count; i++) {
    const index = remaining.findIndex((a) => a.species === species);
    if (index === -1) {
      throw new Error(`Player ${fromId} does not own enough ${species} cards to transfer ${count}.`);
    }
    removed.push(remaining[index]!);
    remaining = remaining.filter((_, i2) => i2 !== index);
  }
  const next = replacePlayer(players, { ...owner, animals: remaining });
  return { players: next, cards: removed };
}

function transferAnimalCards(players: Player[], toId: string, cards: AnimalCard[]): Player[] {
  const payee = findPlayer(players, toId);
  return replacePlayer(players, { ...payee, animals: [...payee.animals, ...cards] });
}

export function applyAuctionResult(players: Player[], result: AuctionResult): Player[] {
  let next = transferAnimalCards(players, result.cardGoesTo, [result.card]);
  if (result.payment) {
    next = transferMoneyCards(next, result.payment.from, result.payment.to, result.payment.cards);
  }
  return next;
}

export function applyKuhhandelResult(players: Player[], result: KuhhandelResult): Player[] {
  if (result.type === 'accept') {
    let next = transferMoneyCards(players, result.moneyFrom, result.moneyGoesTo, result.money);
    const { players: afterRemoval, cards } = removeAnimalsOfSpecies(
      next,
      result.cardComesFrom,
      result.species,
      result.cardCount,
    );
    return transferAnimalCards(afterRemoval, result.cardGoesTo, cards);
  }

  if (result.type === 'tie_reoffer_needed') {
    return players;
  }

  // counter_resolved / tie_default_initiator_wins: only the animal(s) move.
  // Each side keeps the money they staked — the rulebook's "chaque joueur
  // conserve l'argent proposé par son adversaire" line means the money
  // never moves at all here (unlike an auction payment), it just stays
  // put since it was never transferred out of either hand in the first
  // place — see the design spec, Finding 5.
  const { players: afterRemoval, cards } = removeAnimalsOfSpecies(
    players,
    result.loserId,
    result.species,
    result.cardCount,
  );
  return transferAnimalCards(afterRemoval, result.winnerId, cards);
}
