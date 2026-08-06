import { NO_BID_SELLER_KEEPS_FREE } from '../config/game.config.js';
import type { AnimalCard, MoneyCard } from '../types.js';

export interface Bid {
  playerId: string;
  cards: MoneyCard[];
  amount: number;
}

export type AuctionStatus = 'bidding' | 'awaiting_seller_decision';

export interface AuctionState {
  card: AnimalCard;
  sellerId: string;
  activeBidders: string[];
  highestBid: Bid | null;
  status: AuctionStatus;
}

export type SellerDecision = 'sell' | 'keep';

export interface AuctionResult {
  card: AnimalCard;
  cardGoesTo: string;
  payment: { from: string; to: string; amount: number; cards: MoneyCard[] } | null;
}

function sumCards(cards: MoneyCard[]): number {
  return cards.reduce((sum, c) => sum + c.value, 0);
}

export function startAuction(
  card: AnimalCard,
  sellerId: string,
  otherPlayerIds: string[],
): AuctionState {
  return {
    card,
    sellerId,
    activeBidders: [...otherPlayerIds],
    highestBid: null,
    status: 'bidding',
  };
}

/**
 * `cards` is the bidder's chosen subset of their own hand — ownership is
 * validated by the caller (GameRoom resolves card IDs against the
 * player's hand before calling in, same pattern as Kuhhandel's
 * submitInitiatorOffer/resolveOffer), not by this pure function.
 */
export function placeBid(state: AuctionState, playerId: string, cards: MoneyCard[]): AuctionState {
  if (playerId === state.sellerId) {
    throw new Error('The seller cannot bid on their own card.');
  }
  if (!state.activeBidders.includes(playerId)) {
    throw new Error(`Player ${playerId} has already passed and cannot bid again.`);
  }
  const amount = sumCards(cards);
  if (state.highestBid !== null && amount <= state.highestBid.amount) {
    throw new Error('Bid must be strictly higher than the current highest bid.');
  }
  if (state.highestBid === null && amount <= 0) {
    throw new Error('Bid must be strictly higher than the current highest bid.');
  }

  return {
    ...state,
    highestBid: { playerId, cards, amount },
  };
}

export function pass(state: AuctionState, playerId: string): AuctionState {
  const activeBidders = state.activeBidders.filter((id) => id !== playerId);
  const shouldResolve =
    activeBidders.length === 0 || (state.highestBid !== null && activeBidders.length === 1);

  return {
    ...state,
    activeBidders,
    status: shouldResolve ? 'awaiting_seller_decision' : 'bidding',
  };
}

/**
 * `sellerPaymentCards` is only used (and required) when `decision ===
 * 'keep'` — the seller pays the highest bidder out of their own hand, a
 * separate card set from the winning bid's cards. Must sum to exactly
 * `highestBid.amount` (no change-making, per spec Non-goals).
 */
export function resolveAuction(
  state: AuctionState,
  decision?: SellerDecision,
  sellerPaymentCards?: MoneyCard[],
): AuctionResult {
  if (state.status !== 'awaiting_seller_decision') {
    throw new Error('Cannot resolve an auction whose bidding round has not finished.');
  }

  if (state.highestBid === null) {
    if (!NO_BID_SELLER_KEEPS_FREE) {
      throw new Error('No-bid behaviour is disabled but no alternative is configured.');
    }
    return { card: state.card, cardGoesTo: state.sellerId, payment: null };
  }

  if (decision === undefined) {
    throw new Error('A seller decision (sell or keep) is required to resolve this auction.');
  }

  const { playerId: buyerId, amount, cards: bidCards } = state.highestBid;

  if (decision === 'sell') {
    return {
      card: state.card,
      cardGoesTo: buyerId,
      payment: { from: buyerId, to: state.sellerId, amount, cards: bidCards },
    };
  }

  if (!sellerPaymentCards) {
    throw new Error('Seller must supply payment cards to keep the card.');
  }
  const paidAmount = sumCards(sellerPaymentCards);
  if (paidAmount !== amount) {
    throw new Error('Seller payment must sum to exactly the highest bid amount.');
  }

  return {
    card: state.card,
    cardGoesTo: state.sellerId,
    payment: { from: state.sellerId, to: buyerId, amount, cards: sellerPaymentCards },
  };
}
