import { describe, expect, it } from 'vitest';
import { startAuction, placeBid, pass, resolveAuction } from '../src/auction/auction.js';
import type { AnimalCard, MoneyCard } from '../src/types.js';

const card: AnimalCard = { id: 'vache-0', species: 'vache' };

function money(...values: number[]): MoneyCard[] {
  return values.map((value, i) => ({ id: `m${i}-${value}`, value }));
}

describe('auction — bidding round', () => {
  it('starts with all non-seller players as active bidders and no highest bid', () => {
    const state = startAuction(card, 'seller', ['p1', 'p2', 'p3']);

    expect(state.status).toBe('bidding');
    expect(state.activeBidders).toEqual(['p1', 'p2', 'p3']);
    expect(state.highestBid).toBeNull();
  });

  it('rejects a bid from the seller (GDD 3.1.2: only other players may bid)', () => {
    const state = startAuction(card, 'seller', ['p1', 'p2']);

    expect(() => placeBid(state, 'seller', money(10))).toThrow(/seller/i);
  });

  it('rejects a bid that does not strictly raise the current highest bid', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(50));

    expect(() => placeBid(state, 'p2', money(50))).toThrow(/strictly higher/i);
    expect(() => placeBid(state, 'p2', money(40))).toThrow(/strictly higher/i);
  });

  it('accepts a strictly higher bid and updates the highest bid', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(50));
    const p2Cards = money(100);
    state = placeBid(state, 'p2', p2Cards);

    expect(state.highestBid).toEqual({ playerId: 'p2', cards: p2Cards, amount: 100 });
  });

  it('accepts a bid composed of multiple combined cards', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(50));
    const combined = money(10, 50); // 60 total, no single card of that value
    state = placeBid(state, 'p2', combined);

    expect(state.highestBid).toEqual({ playerId: 'p2', cards: combined, amount: 60 });
  });

  it('removes a player from active bidders once they pass, and they cannot bid again', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2', 'p3']);
    state = pass(state, 'p1');

    expect(state.activeBidders).toEqual(['p2', 'p3']);
    expect(() => placeBid(state, 'p1', money(999))).toThrow(/passed/i);
  });

  it('moves to awaiting seller decision once only one bidder remains', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2', 'p3']);
    state = placeBid(state, 'p1', money(50));
    state = pass(state, 'p2');
    state = pass(state, 'p3');

    expect(state.status).toBe('awaiting_seller_decision');
  });

  it('moves to awaiting seller decision once everyone has passed with no bids at all', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = pass(state, 'p1');
    state = pass(state, 'p2');

    expect(state.status).toBe('awaiting_seller_decision');
    expect(state.highestBid).toBeNull();
  });
});

describe('resolveAuction', () => {
  it('sell: buyer pays the seller with their bid cards and receives the card', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    const bidCards = money(100);
    state = placeBid(state, 'p1', bidCards);
    state = pass(state, 'p2');

    const result = resolveAuction(state, 'sell');

    expect(result).toEqual({
      card,
      cardGoesTo: 'p1',
      payment: { from: 'p1', to: 'seller', amount: 100, cards: bidCards },
    });
  });

  it('keep: seller pays the highest bidder with seller-supplied cards and keeps the card', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(100));
    state = pass(state, 'p2');
    const sellerPaymentCards = money(100);

    const result = resolveAuction(state, 'keep', sellerPaymentCards);

    expect(result).toEqual({
      card,
      cardGoesTo: 'seller',
      payment: { from: 'seller', to: 'p1', amount: 100, cards: sellerPaymentCards },
    });
  });

  it('keep: accepts seller payment combined from multiple cards summing exactly', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(60));
    state = pass(state, 'p2');
    const sellerPaymentCards = money(10, 50);

    const result = resolveAuction(state, 'keep', sellerPaymentCards);

    expect(result.payment).toEqual({ from: 'seller', to: 'p1', amount: 60, cards: sellerPaymentCards });
  });

  it('keep: rejects seller payment that does not sum to exactly the highest bid', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(100));
    state = pass(state, 'p2');

    expect(() => resolveAuction(state, 'keep', money(50))).toThrow(/exactly/i);
  });

  it('keep: requires payment cards to be supplied at all', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(100));
    state = pass(state, 'p2');

    expect(() => resolveAuction(state, 'keep')).toThrow(/payment/i);
  });

  it('no bids at all: seller keeps the card for free (GDD 3.1.6 default)', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = pass(state, 'p1');
    state = pass(state, 'p2');

    const result = resolveAuction(state);

    expect(result).toEqual({ card, cardGoesTo: 'seller', payment: null });
  });

  it('throws if resolved before the bidding round has concluded', () => {
    const state = startAuction(card, 'seller', ['p1', 'p2']);

    expect(() => resolveAuction(state, 'sell')).toThrow(/not.*finished|bidding/i);
  });

  it('throws if a sell/keep decision is required but not provided', () => {
    let state = startAuction(card, 'seller', ['p1', 'p2']);
    state = placeBid(state, 'p1', money(100));
    state = pass(state, 'p2');

    expect(() => resolveAuction(state)).toThrow(/decision/i);
  });
});
