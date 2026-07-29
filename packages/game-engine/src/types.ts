import type { MoneyDenomination } from './config/money.config.js';
import type { SpeciesKey } from './config/species.config.js';
import type { MoneyBank } from './money/moneyBank.js';

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
  | 'LOBBY'
  | 'TURN_START'
  | 'AUCTION_FLOW'
  | 'KUHHANDEL_FLOW'
  | 'FORCED_KUHHANDEL'
  | 'SCORING'
  | 'GAME_OVER';

export interface GameState {
  phase: GamePhase;
  players: Player[];
  deck: AnimalCard[];
  activePlayerIndex: number;
  moneyBank: MoneyBank;
  donkeyRevealCount: number;
}
