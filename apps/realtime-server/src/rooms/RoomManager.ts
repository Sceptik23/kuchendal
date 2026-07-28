import { GameRoom } from "../room/GameRoom.js";
import type { GamePersistenceAdapter } from "../persistence/types.js";
import type { MoneyCard, RandomSource } from "@kuhhandel/game-engine";
import type { NarratorStyle } from "@kuhhandel/narrator-engine";

export type LobbyType = "public" | "private" | "password";

export interface CreateRoomOptions {
  type: LobbyType;
  password?: string;
  narratorStyle?: NarratorStyle;
}

interface RoomEntry {
  room: GameRoom;
  type: LobbyType;
  password: string | null;
}

export interface PublicRoomListing {
  code: string;
  playerCount: number;
  status: string;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids ambiguity
const CODE_LENGTH = 6;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Owns every live GameRoom for the process, keyed by a short shareable
 * code (02_PRD_PRODUCT.md §3: public/privé/protégé par mot de passe lobbies,
 * partagé via code court/QR/lien).
 */
export class RoomManager {
  private rooms = new Map<string, RoomEntry>();

  constructor(
    private readonly persistenceFactory?: () => GamePersistenceAdapter,
    private readonly rng: RandomSource = Math.random,
    private readonly startingMoneyFactory?: () => MoneyCard[],
  ) {}

  createRoom(options: CreateRoomOptions): { code: string; room: GameRoom } {
    let code = generateCode();
    while (this.rooms.has(code)) code = generateCode();

    const room = new GameRoom(
      this.rng,
      this.startingMoneyFactory,
      this.persistenceFactory?.(),
      options.narratorStyle,
    );

    this.rooms.set(code, {
      room,
      type: options.type,
      password: options.type === "password" ? (options.password ?? null) : null,
    });

    return { code, room };
  }

  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code)?.room;
  }

  /** Throws if the code doesn't exist or the password is missing/wrong. */
  authorizeJoin(code: string, password?: string): void {
    const entry = this.rooms.get(code);
    if (!entry) {
      throw new Error(`Room not found: ${code}`);
    }
    if (entry.type === "password" && password !== entry.password) {
      throw new Error("Incorrect room password.");
    }
  }

  listPublicRooms(): PublicRoomListing[] {
    const listing: PublicRoomListing[] = [];
    for (const [code, entry] of this.rooms) {
      if (entry.type !== "public") continue;
      const summary = entry.room.getSummary();
      listing.push({ code, playerCount: summary.playerCount, status: summary.status });
    }
    return listing;
  }

  removeRoom(code: string): void {
    this.rooms.delete(code);
  }
}
