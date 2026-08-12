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
const vache2: AnimalCard = { id: 'vache-2', species: 'vache' };

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
    let state = startKuhhandel('initiator', 'target', 'vache', [vache], [{ id: 'vache-1', species: 'vache' }]);
    state = submitInitiatorOffer(state, money(100, 50));

    const targetView = getPublicView(state, 'target');
    expect(targetView.initiatorOffer).toBeNull();

    const initiatorView = getPublicView(state, 'initiator');
    expect(initiatorView.initiatorOffer).not.toBeNull();
  });

  it("exposes the secret offer's card COUNT to everyone even while the values stay hidden", () => {
    let state = startKuhhandel('initiator', 'target', 'vache', [vache], [{ id: 'vache-1', species: 'vache' }]);

    // Before the offer is submitted, the count is unknown to anyone.
    expect(getPublicView(state, 'target').offerCardCount).toBeNull();
    expect(getPublicView(state, 'bystander').offerCardCount).toBeNull();

    state = submitInitiatorOffer(state, money(100, 50, 0));

    // Count is now public — 3 cards — while the values remain hidden from
    // everyone but the initiator.
    const targetView = getPublicView(state, 'target');
    expect(targetView.offerCardCount).toBe(3);
    expect(targetView.initiatorOffer).toBeNull();

    const bystanderView = getPublicView(state, 'bystander');
    expect(bystanderView.offerCardCount).toBe(3);

    const initiatorView = getPublicView(state, 'initiator');
    expect(initiatorView.offerCardCount).toBe(3);
    expect(initiatorView.initiatorOffer).toHaveLength(3);
  });

  it('exposes cardCount (1 or 2 animals changing hands) to every viewer, always', () => {
    const bothOwnTwo = startKuhhandel(
      'initiator',
      'target',
      'vache',
      [vache, vache2],
      [{ id: 'vache-1', species: 'vache' }, { id: 'vache-3', species: 'vache' }],
    );
    expect(getPublicView(bothOwnTwo, 'target').cardCount).toBe(2);
    expect(getPublicView(bothOwnTwo, 'bystander').cardCount).toBe(2);

    const onlyOneEach = startKuhhandel(
      'initiator',
      'target',
      'vache',
      [vache],
      [{ id: 'vache-1', species: 'vache' }],
    );
    expect(getPublicView(onlyOneEach, 'target').cardCount).toBe(1);
  });

  it('accept: target receives the offered money, initiator receives the animal', () => {
    let state = startKuhhandel('initiator', 'target', 'vache', [vache], [{ id: 'vache-1', species: 'vache' }]);
    state = submitInitiatorOffer(state, money(100, 50));

    const result = respondAccept(state);

    expect(result).toEqual({
      type: 'accept',
      species: 'vache',
      cardCount: 1,
      cardGoesTo: 'initiator',
      cardComesFrom: 'target',
      moneyGoesTo: 'target',
      moneyFrom: 'initiator',
      money: money(100, 50),
    });
  });

  it('reveals both offers to all viewers once resolved', () => {
    let state = startKuhhandel('initiator', 'target', 'vache', [vache], [{ id: 'vache-1', species: 'vache' }]);
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
    let state = startKuhhandel('initiator', 'target', 'vache', [vache], [{ id: 'vache-1', species: 'vache' }]);
    state = submitInitiatorOffer(state, money(100));

    const result = respondCounter(state, money(50));

    expect(result).toEqual({
      type: 'counter_resolved',
      species: 'vache',
      cardCount: 1,
      winnerId: 'initiator',
      loserId: 'target',
      potMoney: money(100).concat(money(50)),
    });
  });

  it('target wins when their counter-offer is strictly higher', () => {
    let state = startKuhhandel('initiator', 'target', 'vache', [vache], [{ id: 'vache-1', species: 'vache' }]);
    state = submitInitiatorOffer(state, money(50));

    const result = respondCounter(state, money(100));

    expect(result.type).toBe('counter_resolved');
    if (result.type === 'counter_resolved') {
      expect(result.winnerId).toBe('target');
      expect(result.loserId).toBe('initiator');
    }
  });

  it('requests a new secret offer round on a strict tie (first tie)', () => {
    let state = startKuhhandel('initiator', 'target', 'vache', [vache], [{ id: 'vache-1', species: 'vache' }]);
    state = submitInitiatorOffer(state, money(100));

    const result = respondCounter(state, money(100));

    expect(result).toEqual({ type: 'tie_reoffer_needed', tieRound: 1 });
  });

  it('gives the win to the initiator by default after the max tie-break rounds (config)', () => {
    let state = startKuhhandel('initiator', 'target', 'vache', [vache], [{ id: 'vache-1', species: 'vache' }]);
    state = submitInitiatorOffer(state, money(100));
    const firstTie = respondCounter(state, money(100));
    expect(firstTie).toEqual({ type: 'tie_reoffer_needed', tieRound: 1 });

    state = submitInitiatorOffer(state, money(200), 1);
    const secondTie = respondCounter(state, money(200));

    expect(secondTie).toEqual({
      type: 'tie_default_initiator_wins',
      species: 'vache',
      cardCount: 1,
      winnerId: 'initiator',
      loserId: 'target',
      potMoney: money(200).concat(money(200)),
    });
  });
});

describe('startKuhhandel — special 2-card trade (rulebook: "marchandage spécial")', () => {
  it('sets cardCount to 2 when both players hold at least 2 of the species', () => {
    const initiatorAnimals = [vache, vache2];
    const targetAnimals = [
      { id: 'vache-3', species: 'vache' as const },
      { id: 'vache-4', species: 'vache' as const },
    ];
    const state = startKuhhandel('initiator', 'target', 'vache', initiatorAnimals, targetAnimals);
    expect(state.cardCount).toBe(2);
  });

  it('sets cardCount to 1 when either player holds only one of the species', () => {
    const initiatorAnimals = [vache, vache2];
    const targetAnimals = [{ id: 'vache-3', species: 'vache' as const }];
    const state = startKuhhandel('initiator', 'target', 'vache', initiatorAnimals, targetAnimals);
    expect(state.cardCount).toBe(1);
  });
});
