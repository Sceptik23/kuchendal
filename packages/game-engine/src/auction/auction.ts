import { NO_BID_SELLER_KEEPS_FREE } from '../config/game.config.js';
import type { AnimalCard } from '../types.js';

export interface Bid {
  playerId: string;
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
  payment: { from: string; to: string; amount: number } | null;
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

export function placeBid(state: AuctionState, playerId: string, amount: number): AuctionState {
  if (playerId === state.sellerId) {
    throw new Error('The seller cannot bid on their own card.');
  }
  if (!state.activeBidders.includes(playerId)) {
    throw new Error(`Player ${playerId} has already passed and cannot bid again.`);
  }
  if (state.highestBid !== null && amount <= state.highestBid.amount) {
    throw new Error('Bid must be strictly higher than the current highest bid.');
  }
  if (state.highestBid === null && amount < 0) {
    throw new Error('Bid must be strictly higher than the current highest bid.');
  }

  return {
    ...state,
    highestBid: { playerId, amount },
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

export function resolveAuction(state: AuctionState, decision?: SellerDecision): AuctionResult {
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

  const { playerId: buyerId, amount } = state.highestBid;

  if (decision === 'sell') {
    return {
      card: state.card,
      cardGoesTo: buyerId,
      payment: { from: buyerId, to: state.sellerId, amount },
    };
  }

  return {
    card: state.card,
    cardGoesTo: state.sellerId,
    payment: { from: state.sellerId, to: buyerId, amount },
  };
}
