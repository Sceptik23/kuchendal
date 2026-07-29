import { KUHHANDEL_TIE_BREAK_MAX_ROUNDS } from '../config/kuhhandel.config.js';
import type { SpeciesKey } from '../config/species.config.js';
import type { AnimalCard, MoneyCard } from '../types.js';

export type KuhhandelStage = 'awaiting_initiator_offer' | 'awaiting_response';

export interface KuhhandelState {
  initiatorId: string;
  targetId: string;
  species: SpeciesKey;
  /** 2 when both players hold ≥2 of the species at trade start ("marchandage spécial") — both cards move at once. Otherwise 1. */
  cardCount: 1 | 2;
  stage: KuhhandelStage;
  /** Secret until reveal — never exposed to the target via getPublicView. */
  initiatorOffer: MoneyCard[] | null;
  tieRound: number;
}

export type KuhhandelResult =
  | {
      type: 'accept';
      species: SpeciesKey;
      cardCount: 1 | 2;
      cardGoesTo: string;
      cardComesFrom: string;
      moneyGoesTo: string;
      moneyFrom: string;
      money: MoneyCard[];
    }
  | {
      type: 'counter_resolved';
      species: SpeciesKey;
      cardCount: 1 | 2;
      winnerId: string;
      loserId: string;
      potMoney: MoneyCard[];
    }
  | {
      type: 'tie_reoffer_needed';
      tieRound: number;
    }
  | {
      type: 'tie_default_initiator_wins';
      species: SpeciesKey;
      cardCount: 1 | 2;
      winnerId: string;
      loserId: string;
      potMoney: MoneyCard[];
    };

export function canInitiateKuhhandel(
  initiatorAnimals: AnimalCard[],
  targetAnimals: AnimalCard[],
  species: SpeciesKey,
): boolean {
  const initiatorHasSpecies = initiatorAnimals.some((card) => card.species === species);
  const targetHasSpecies = targetAnimals.some((card) => card.species === species);
  return initiatorHasSpecies && targetHasSpecies;
}

export function startKuhhandel(
  initiatorId: string,
  targetId: string,
  species: SpeciesKey,
  initiatorAnimals: AnimalCard[],
  targetAnimals: AnimalCard[],
): KuhhandelState {
  const ownedBy = (animals: AnimalCard[]) => animals.filter((a) => a.species === species).length;
  const cardCount: 1 | 2 = ownedBy(initiatorAnimals) >= 2 && ownedBy(targetAnimals) >= 2 ? 2 : 1;

  return {
    initiatorId,
    targetId,
    species,
    cardCount,
    stage: 'awaiting_initiator_offer',
    initiatorOffer: null,
    tieRound: 0,
  };
}

export function submitInitiatorOffer(
  state: KuhhandelState,
  offer: MoneyCard[],
  tieRound = 0,
): KuhhandelState {
  return {
    ...state,
    initiatorOffer: offer,
    stage: 'awaiting_response',
    tieRound,
  };
}

export function respondAccept(state: KuhhandelState): Extract<KuhhandelResult, { type: 'accept' }> {
  if (state.stage !== 'awaiting_response' || state.initiatorOffer === null) {
    throw new Error('Cannot accept before the initiator has submitted a secret offer.');
  }

  return {
    type: 'accept',
    species: state.species,
    cardCount: state.cardCount,
    cardGoesTo: state.initiatorId,
    cardComesFrom: state.targetId,
    moneyGoesTo: state.targetId,
    moneyFrom: state.initiatorId,
    money: state.initiatorOffer,
  };
}

function offerTotal(cards: MoneyCard[]): number {
  return cards.reduce((sum, card) => sum + card.value, 0);
}

export function respondCounter(state: KuhhandelState, counterOffer: MoneyCard[]): KuhhandelResult {
  if (state.stage !== 'awaiting_response' || state.initiatorOffer === null) {
    throw new Error('Cannot counter before the initiator has submitted a secret offer.');
  }

  const initiatorTotal = offerTotal(state.initiatorOffer);
  const targetTotal = offerTotal(counterOffer);
  const potMoney = [...state.initiatorOffer, ...counterOffer];

  if (initiatorTotal === targetTotal) {
    const nextTieRound = state.tieRound + 1;
    if (nextTieRound >= KUHHANDEL_TIE_BREAK_MAX_ROUNDS) {
      return {
        type: 'tie_default_initiator_wins',
        species: state.species,
        cardCount: state.cardCount,
        winnerId: state.initiatorId,
        loserId: state.targetId,
        potMoney,
      };
    }
    return { type: 'tie_reoffer_needed', tieRound: nextTieRound };
  }

  const initiatorWins = initiatorTotal > targetTotal;
  return {
    type: 'counter_resolved',
    species: state.species,
    cardCount: state.cardCount,
    winnerId: initiatorWins ? state.initiatorId : state.targetId,
    loserId: initiatorWins ? state.targetId : state.initiatorId,
    potMoney,
  };
}

export interface KuhhandelPublicView {
  initiatorId: string;
  targetId: string;
  species: SpeciesKey;
  stage: KuhhandelStage;
  initiatorOffer: MoneyCard[] | null;
}

/**
 * Redacted view of the state for a given viewer — the initiator's secret
 * offer is never exposed to anyone but the initiator before resolution
 * (cf. 03_ARCHITECTURE.md §5: hidden information must never transit to a
 * client not entitled to see it, even in the raw payload).
 */
export function getPublicView(state: KuhhandelState, viewerId: string): KuhhandelPublicView {
  const canSeeOffer = viewerId === state.initiatorId;
  return {
    initiatorId: state.initiatorId,
    targetId: state.targetId,
    species: state.species,
    stage: state.stage,
    initiatorOffer: canSeeOffer ? state.initiatorOffer : null,
  };
}
