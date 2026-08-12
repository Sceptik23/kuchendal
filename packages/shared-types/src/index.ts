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

/**
 * Wire-facing projection of the engine-internal `AuctionState`: the
 * highest bid's full `MoneyCard[]` (which carries `.value`, i.e. exact
 * denominations) is redacted down to opaque `cardIds`. The engine keeps
 * the full `cards` array internally for resolution (transferring the
 * actual cards), but every opponent seeing the full breakdown of a bid
 * (e.g. "holds a 50 and two 10s") would leak information beyond the
 * already-public bid amount — this game's Kuhhandel mechanic depends on
 * hidden-money bluffing, so that's a real leak, not a cosmetic one.
 */
export interface AuctionStateView {
  card: AuctionState['card'];
  sellerId: string;
  activeBidders: string[];
  highestBid: { playerId: string; cardIds: string[]; amount: number } | null;
  status: AuctionState['status'];
}

export interface GameStateView {
  status: RoomStatus;
  phase: GamePhase;
  players: PlayerView[];
  activePlayerId: string | null;
  hostPlayerId: string | null;
  deckCount: number;
  auction: AuctionStateView | null;
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
  "turn:startKuhhandel": (payload: { targetId: string; species: string; cardCount?: 1 | 2 }) => void;
  "auction:bid": (payload: { moneyCardIds: string[] }) => void;
  "auction:pass": () => void;
  "auction:sellerDecision": (payload: { decision: "sell" | "keep"; paymentCardIds?: string[] }) => void;
  "kuhhandel:submitOffer": (payload: { moneyCardIds: string[] }) => void;
  "kuhhandel:accept": () => void;
  "kuhhandel:counter": (payload: { moneyCardIds: string[] }) => void;
  /**
   * Re-registers this socket against `roomCode`/`playerId` and re-requests
   * a fresh `state:update`. Necessary, not just a nicety: socket.io issues
   * a brand-new socket.id on every reconnect (WiFi blip, tab backgrounded,
   * laptop sleep), and the server only maps playerId -> socket.id per
   * connection — a reconnected socket that never re-sends this is
   * invisible to the room forever after, silently missing every future
   * broadcast (including the results of its own subsequent actions) with
   * no error shown, which reads to the player as "the bots stopped
   * reacting". Read-only otherwise, no room mutation. Both an automatic
   * call on socket reconnect and the manual "↻ Actualiser" button use
   * this same event.
   */
  "state:resync": (payload: { roomCode: string; playerId: string }) => void;
}

export interface ServerToClientEvents {
  "state:update": (state: GameStateView) => void;
  "error:action": (payload: { message: string }) => void;
  "lobby:kicked": () => void;
}
