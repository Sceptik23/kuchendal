import type { MoneyDenomination } from './config/money.config.js';
import type { SpeciesKey } from './config/species.config.js';

export interface AnimalCard {
  id: string;
  species: SpeciesKey;
}

export interface MoneyCard {
  id: string;
  value: MoneyDenomination;
}

export interface Player {
  id: string;
  name: string;
  money: MoneyCard[];
  animals: AnimalCard[];
}

export type GamePhase =
  'LOBBY' | 'TURN_START' | 'AUCTION_FLOW' | 'KUHHANDEL_FLOW' | 'SCORING' | 'GAME_OVER';

export interface GameState {
  phase: GamePhase;
  players: Player[];
  deck: AnimalCard[];
  activePlayerIndex: number;
}
