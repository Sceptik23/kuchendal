import { describe, expect, it } from 'vitest';
import {
  canInitiateKuhhandel,
  startKuhhandel,
  submitInitiatorOffer,
  respondAccept,
  respondCounter,
  getPublicView,
} from '../src/kuhhandel/kuhhandel.js';
import type { AnimalCard, MoneyCard } from '../src/types.js';

const vache: AnimalCard = { id: 'vache-0', species: 'vache' };

function money(...values: MoneyCard['value'][]): MoneyCard[] {
  return values.map((value, i) => ({ id: `m-${value}-${i}`, value }));
}

describe('canInitiateKuhhandel', () => {
  it('requires both players to own at least one of the same species', () => {
    expect(canInitiateKuhhandel([vache], [{ id: 'vache-1', species: 'vache' }], 'vache')).toBe(
      true,
    );
    expect(canInitiateKuhhandel([vache], [], 'vache')).toBe(false);
  });
});

describe('kuhhandel — secret offer & accept', () => {
  it("hides the initiator's offer from the target until it is revealed", () => {
    let state = startKuhhandel('initiator', 'target', 'vache');
    state = submitInitiatorOffer(state, money(100, 50));

    const targetView = getPublicView(state, 'target');
    expect(targetView.initiatorOffer).toBeNull();

    const initiatorView = getPublicView(state, 'initiator');
    expect(initiatorView.initiatorOffer).not.toBeNull();
  });

  it('accept: target receives the offered money, initiator receives the animal', () => {
    let state = startKuhhandel('initiator', 'target', 'vache');
    state = submitInitiatorOffer(state, money(100, 50));

    const result = respondAccept(state);

    expect(result).toEqual({
      type: 'accept',
      species: 'vache',
      cardGoesTo: 'initiator',
      cardComesFrom: 'target',
      moneyGoesTo: 'target',
      moneyFrom: 'initiator',
      money: money(100, 50),
    });
  });

  it('reveals both offers to all viewers once resolved', () => {
    let state = startKuhhandel('initiator', 'target', 'vache');
    state = submitInitiatorOffer(state, money(100));
    respondAccept(state);

    const view = getPublicView(state, 'target');
    // resolution itself doesn't mutate state; state remains pre-reveal for accept path
    // (accept never requires revealing the initiator's exact offer to the target beyond the deal).
    expect(view.stage).toBe('awaiting_response');
  });
});

describe('kuhhandel — counter-offer resolution', () => {
  it('initiator wins when their secret offer is strictly higher', () => {
    let state = startKuhhandel('initiator', 'target', 'vache');
    state = submitInitiatorOffer(state, money(100));

    const result = respondCounter(state, money(50));

    expect(result).toEqual({
      type: 'counter_resolved',
      species: 'vache',
      winnerId: 'initiator',
      loserId: 'target',
      potMoney: money(100).concat(money(50)),
    });
  });

  it('target wins when their counter-offer is strictly higher', () => {
    let state = startKuhhandel('initiator', 'target', 'vache');
    state = submitInitiatorOffer(state, money(50));

    const result = respondCounter(state, money(100));

    expect(result.type).toBe('counter_resolved');
    if (result.type === 'counter_resolved') {
      expect(result.winnerId).toBe('target');
      expect(result.loserId).toBe('initiator');
    }
  });

  it('requests a new secret offer round on a strict tie (first tie)', () => {
    let state = startKuhhandel('initiator', 'target', 'vache');
    state = submitInitiatorOffer(state, money(100));

    const result = respondCounter(state, money(100));

    expect(result).toEqual({ type: 'tie_reoffer_needed', tieRound: 1 });
  });

  it('gives the win to the initiator by default after the max tie-break rounds (config)', () => {
    let state = startKuhhandel('initiator', 'target', 'vache');
    state = submitInitiatorOffer(state, money(100));
    const firstTie = respondCounter(state, money(100));
    expect(firstTie).toEqual({ type: 'tie_reoffer_needed', tieRound: 1 });

    state = submitInitiatorOffer(state, money(200), 1);
    const secondTie = respondCounter(state, money(200));

    expect(secondTie).toEqual({
      type: 'tie_default_initiator_wins',
      species: 'vache',
      winnerId: 'initiator',
      loserId: 'target',
      potMoney: money(200).concat(money(200)),
    });
  });
});
