import type {
  AnimalCard,
  AuctionState,
  GamePhase,
  KuhhandelPublicView,
  MoneyCard,
} from "@kuhhandel/game-engine";
import type { NarratorMessage, NarratorStyle } from "@kuhhandel/narrator-engine";
import type { DistinctionEntry } from "@kuhhandel/distinctions-engine";
import type { RareEventEntry } from "@kuhhandel/rare-events-engine";

export type { NarratorMessage, NarratorStyle, DistinctionEntry, RareEventEntry, GamePhase };

/** Species value table + key union — see `./species.ts` for why this is a
 * static local copy rather than a re-export from `@kuhhandel/game-engine`. */
export { SPECIES_FAMILY_VALUE } from "./species.js";
export type { SpeciesKey } from "./species.js";

export type RoomStatus = "lobby" | "in_progress" | "finished";
export type LobbyType = "public" | "private" | "password";

/**
 * Per-viewer player projection. `money` is only ever populated when the
 * view is generated for that same player — every other viewer only learns
 * the card count (cf. 03_ARCHITECTURE.md §7: a player's hand is sensitive
 * data and must never reach other clients).
 */
export interface PlayerView {
  id: string;
  name: string;
  animals: AnimalCard[];
  moneyCount: number;
  money: MoneyCard[] | null;
  score: number | null;
  isBot: boolean;
}

export interface GameStateView {
  status: RoomStatus;
  phase: GamePhase;
  players: PlayerView[];
  activePlayerId: string | null;
  hostPlayerId: string | null;
  deckCount: number;
  auction: AuctionState | null;
  kuhhandel: KuhhandelPublicView | null;
  /** Recent narrator comments (08_AI.md §1), most recent last. */
  narratorFeed: NarratorMessage[];
  /** Hall of Shame/Fame distinctions (08_AI.md §3) — only populated once the game has finished. */
  distinctions: DistinctionEntry[];
  /** Recent rare events (07_META_GAME.md §6) — cosmetic only, never affects scoring. */
  rareEventsFeed: RareEventEntry[];
  /** How many golden donkeys have been revealed so far — increments the
   * known 50/100/200/500 bonus sequence (client derives the payout amount
   * from this count, not from a duplicated wire field). */
  donkeyRevealCount: number;
}

export interface PublicRoomListing {
  code: string;
  playerCount: number;
  status: string;
}

export type BotDifficulty = "easy" | "normal";

export interface ClientToServerEvents {
  "lobby:create": (
    payload: { type: LobbyType; password?: string; narratorStyle?: NarratorStyle },
    ack: (code: string) => void,
  ) => void;
  "lobby:list": (ack: (rooms: PublicRoomListing[]) => void) => void;
  "lobby:join": (
    payload: { code: string; name: string; accessToken?: string; password?: string },
    ack: (result: { playerId: string } | { error: string }) => void,
  ) => void;
  "lobby:start": () => void;
  "host:kick": (payload: { playerId: string }) => void;
  "host:transfer": (payload: { playerId: string }) => void;
  "host:addBot": (payload?: { difficulty?: BotDifficulty }) => void;
  "turn:startAuction": () => void;
  "turn:startKuhhandel": (payload: { targetId: string; species: string }) => void;
  "auction:bid": (payload: { amount: number }) => void;
  "auction:pass": () => void;
  "auction:sellerDecision": (payload: { decision: "sell" | "keep" }) => void;
  "kuhhandel:submitOffer": (payload: { moneyCardIds: string[] }) => void;
  "kuhhandel:accept": () => void;
  "kuhhandel:counter": (payload: { moneyCardIds: string[] }) => void;
}

export interface ServerToClientEvents {
  "state:update": (state: GameStateView) => void;
  "error:action": (payload: { message: string }) => void;
  "lobby:kicked": () => void;
}
