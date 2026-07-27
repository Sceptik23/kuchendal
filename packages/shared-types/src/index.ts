import type {
  AnimalCard,
  AuctionState,
  KuhhandelPublicView,
  MoneyCard,
} from "@kuhhandel/game-engine";

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
  players: PlayerView[];
  activePlayerId: string | null;
  hostPlayerId: string | null;
  deckCount: number;
  auction: AuctionState | null;
  kuhhandel: KuhhandelPublicView | null;
}

export interface PublicRoomListing {
  code: string;
  playerCount: number;
  status: string;
}

export interface ClientToServerEvents {
  "lobby:create": (
    payload: { type: LobbyType; password?: string },
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
  "host:addBot": () => void;
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
