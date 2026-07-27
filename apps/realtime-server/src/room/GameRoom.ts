import {
  MIN_PLAYERS,
  MAX_PLAYERS,
  createShuffledDeck,
  createStartingMoney,
  computeScore,
  isGameOver,
  nextPlayerIndex,
  startAuction,
  placeBid as engPlaceBid,
  pass as engPass,
  resolveAuction,
  canInitiateKuhhandel,
  startKuhhandel,
  submitInitiatorOffer,
  respondAccept as engRespondAccept,
  respondCounter as engRespondCounter,
  getPublicView as getKuhhandelPublicView,
  applyAuctionResult,
  applyKuhhandelResult,
} from '@kuhhandel/game-engine';
import type {
  AnimalCard,
  AuctionState,
  KuhhandelState,
  MoneyCard,
  Player,
  RandomSource,
  SellerDecision,
  SpeciesKey,
} from '@kuhhandel/game-engine';
import type { GameStateView, PlayerView, RoomStatus } from '@kuhhandel/shared-types';
import { NullPersistenceAdapter, type GamePersistenceAdapter } from '../persistence/types.js';
import {
  SPECIES_FAMILY_VALUE,
  STARTING_MONEY,
  KUHHANDEL_TIE_BREAK_MAX_ROUNDS,
  NO_BID_SELLER_KEEPS_FREE,
  GAME_END_CONDITION,
  REMAINING_MONEY_COUNTS_IN_SCORE,
} from '@kuhhandel/game-engine';

let playerIdCounter = 0;

function rulesetConfigSnapshot() {
  return {
    speciesFamilyValue: SPECIES_FAMILY_VALUE,
    startingMoney: STARTING_MONEY,
    kuhhandelTieBreakMaxRounds: KUHHANDEL_TIE_BREAK_MAX_ROUNDS,
    noBidSellerKeepsFree: NO_BID_SELLER_KEEPS_FREE,
    gameEndCondition: GAME_END_CONDITION,
    remainingMoneyCountsInScore: REMAINING_MONEY_COUNTS_IN_SCORE,
  };
}

export class GameRoom {
  private status: RoomStatus = 'lobby';
  private players: Player[] = [];
  private deck: AnimalCard[] = [];
  private activePlayerIndex = 0;
  private auction: AuctionState | null = null;
  private kuhhandel: KuhhandelState | null = null;
  private userIdByPlayerId = new Map<string, string | null>();
  private botPlayerIds = new Set<string>();
  private hostPlayerId: string | null = null;
  private gameIdPromise: Promise<string> | null = null;
  private botCounter = 0;
  private turnNumber = 0;

  constructor(
    private readonly rng: RandomSource = Math.random,
    private readonly startingMoneyFactory: () => MoneyCard[] = createStartingMoney,
    private readonly persistence: GamePersistenceAdapter = new NullPersistenceAdapter(),
  ) {}

  /** Fire-and-forget: persistence never blocks or throws back into gameplay. */
  private withGameId(fn: (gameId: string) => Promise<void>): void {
    this.gameIdPromise
      ?.then((gameId) => {
        if (gameId) return fn(gameId);
        return undefined;
      })
      .catch((error) => console.error('[persistence]', error));
  }

  join(name: string, userId: string | null = null, isBot = false): string {
    if (this.status !== 'lobby') {
      throw new Error('Cannot join: the game has already started.');
    }
    if (this.players.length >= MAX_PLAYERS) {
      throw new Error('This room is full.');
    }
    const id = `player-${playerIdCounter++}`;
    this.players.push({ id, name, money: [], animals: [] });
    this.userIdByPlayerId.set(id, userId);
    if (isBot) this.botPlayerIds.add(id);
    if (this.hostPlayerId === null) this.hostPlayerId = id;
    return id;
  }

  private requireHost(requesterId: string): void {
    if (requesterId !== this.hostPlayerId) {
      throw new Error('Only the host can do this.');
    }
  }

  /**
   * Adds a bot player slot (02_PRD_PRODUCT.md §3: host can add bots to
   * complete the table). Behaviour is a minimal deterministic stub for now
   * (see runBotLoop below) — the real heuristic decision logic from
   * 08_AI.md arrives in Phase 7 and will replace this same code path.
   */
  addBot(requesterId: string): string {
    this.requireHost(requesterId);
    if (this.status !== 'lobby') {
      throw new Error('Cannot add a bot once the game has started.');
    }
    this.botCounter += 1;
    return this.join(`Bot ${this.botCounter}`, null, true);
  }

  kickPlayer(requesterId: string, targetId: string): void {
    this.requireHost(requesterId);
    if (this.status !== 'lobby') {
      throw new Error('Cannot kick a player once the game has started.');
    }
    if (requesterId === targetId) {
      throw new Error('The host cannot kick themselves.');
    }
    const existed = this.players.some((p) => p.id === targetId);
    if (!existed) throw new Error(`Unknown player: ${targetId}`);
    this.players = this.players.filter((p) => p.id !== targetId);
    this.userIdByPlayerId.delete(targetId);
    this.botPlayerIds.delete(targetId);
  }

  transferHost(requesterId: string, targetId: string): void {
    this.requireHost(requesterId);
    this.findPlayer(targetId);
    this.hostPlayerId = targetId;
  }

  start(): void {
    if (this.status !== 'lobby') {
      throw new Error('The game has already started.');
    }
    if (this.players.length < MIN_PLAYERS) {
      throw new Error(`At least ${MIN_PLAYERS} players are required to start.`);
    }
    this.deck = createShuffledDeck(this.rng);
    this.players = this.players.map((p) => ({ ...p, money: this.startingMoneyFactory() }));
    this.activePlayerIndex = 0;
    this.status = 'in_progress';

    const hostUserId = this.userIdByPlayerId.get(this.players[0]!.id) ?? null;
    this.gameIdPromise = this.persistence
      .createGame(hostUserId, rulesetConfigSnapshot())
      .catch((error) => {
        console.error('[persistence]', error);
        return '';
      });
    this.withGameId(async (gameId) => {
      for (const player of this.players) {
        await this.persistence.addPlayer(
          gameId,
          this.userIdByPlayerId.get(player.id) ?? null,
          this.botPlayerIds.has(player.id),
        );
      }
    });

    this.runBotLoop();
  }

  /**
   * Minimal deterministic stand-in so a lobby with bot slots is actually
   * playable now, without waiting for the heuristic bots of 08_AI.md
   * (Phase 7): a bot always reveals a card on its own turn, always passes
   * as a bidder, always sells as a seller, and always accepts a Kuhhandel
   * offered to it. This function is the single place that logic lives —
   * Phase 7 replaces its body, not the call sites.
   */
  private runBotLoop(): void {
    if (this.status !== 'in_progress') return;

    if (this.kuhhandel) {
      if (this.kuhhandel.stage === 'awaiting_response' && this.botPlayerIds.has(this.kuhhandel.targetId)) {
        this.respondAccept(this.kuhhandel.targetId);
      }
      return;
    }

    if (this.auction) {
      const state = this.auction;
      if (state.status === 'bidding') {
        const botBidder = state.activeBidders.find((id) => this.botPlayerIds.has(id));
        if (botBidder) this.pass(botBidder);
        return;
      }
      if (state.status === 'awaiting_seller_decision' && this.botPlayerIds.has(state.sellerId)) {
        this.sellerDecision(state.sellerId, 'sell');
      }
      return;
    }

    if (this.botPlayerIds.has(this.activePlayer.id)) {
      this.startAuction(this.activePlayer.id);
    }
  }

  private get activePlayer(): Player {
    return this.players[this.activePlayerIndex]!;
  }

  private findPlayer(id: string): Player {
    const player = this.players.find((p) => p.id === id);
    if (!player) throw new Error(`Unknown player: ${id}`);
    return player;
  }

  private requireActionable(): void {
    if (this.status !== 'in_progress') {
      throw new Error('The game is not in progress.');
    }
  }

  private requireActivePlayer(playerId: string): void {
    if (playerId !== this.activePlayer.id) {
      throw new Error(`It is not player ${playerId}'s turn.`);
    }
  }

  private endTurn(): void {
    this.auction = null;
    this.kuhhandel = null;
    if (isGameOver(this.deck)) {
      this.status = 'finished';
      const scored = this.players
        .map((p) => ({ playerId: p.id, score: computeScore(p) }))
        .sort((a, b) => b.score - a.score);
      const results = scored.map(({ playerId, score }, index) => ({
        userId: this.userIdByPlayerId.get(playerId) ?? null,
        score,
        rank: index + 1,
      }));
      this.withGameId((gameId) => this.persistence.finishGame(gameId, results));
      return;
    }
    this.activePlayerIndex = nextPlayerIndex(this.activePlayerIndex, this.players.length);
    this.turnNumber += 1;
    this.withGameId((gameId) =>
      this.persistence.saveSnapshot(gameId, this.turnNumber, {
        players: this.players,
        deck: this.deck,
        activePlayerIndex: this.activePlayerIndex,
      }),
    );
  }

  startAuction(playerId: string): void {
    this.requireActionable();
    this.requireActivePlayer(playerId);
    if (this.auction || this.kuhhandel) {
      throw new Error('A flow is already in progress this turn.');
    }
    if (isGameOver(this.deck)) {
      throw new Error('The deck is empty, no card left to auction.');
    }
    const card = this.deck[0]!;
    this.deck = this.deck.slice(1);
    const otherIds = this.players.filter((p) => p.id !== playerId).map((p) => p.id);
    this.auction = startAuction(card, playerId, otherIds);
    this.runBotLoop();
  }

  private requireAuction(): AuctionState {
    if (!this.auction) throw new Error('No auction is currently in progress.');
    return this.auction;
  }

  placeBid(playerId: string, amount: number): void {
    this.requireActionable();
    this.auction = engPlaceBid(this.requireAuction(), playerId, amount);
  }

  pass(playerId: string): void {
    this.requireActionable();
    this.auction = engPass(this.requireAuction(), playerId);
    this.runBotLoop();
  }

  sellerDecision(playerId: string, decision: SellerDecision): void {
    this.requireActionable();
    this.requireActivePlayer(playerId);
    const result = resolveAuction(this.requireAuction(), decision);
    this.players = applyAuctionResult(this.players, result);
    this.withGameId((gameId) => this.persistence.logEvent(gameId, 'AUCTION_RESOLVED', result));
    this.endTurn();
    this.runBotLoop();
  }

  startKuhhandel(initiatorId: string, targetId: string, species: SpeciesKey): void {
    this.requireActionable();
    this.requireActivePlayer(initiatorId);
    if (this.auction || this.kuhhandel) {
      throw new Error('A flow is already in progress this turn.');
    }
    const initiator = this.findPlayer(initiatorId);
    const target = this.findPlayer(targetId);
    if (!canInitiateKuhhandel(initiator.animals, target.animals, species)) {
      throw new Error('Both players must own at least one animal of that species.');
    }
    this.kuhhandel = startKuhhandel(initiatorId, targetId, species);
    this.runBotLoop();
  }

  private requireKuhhandel(): KuhhandelState {
    if (!this.kuhhandel) throw new Error('No Kuhhandel is currently in progress.');
    return this.kuhhandel;
  }

  private resolveOffer(playerId: string, cardIds: string[]): MoneyCard[] {
    const player = this.findPlayer(playerId);
    const cards = cardIds.map((id) => {
      const card = player.money.find((m) => m.id === id);
      if (!card) throw new Error(`Player ${playerId} does not hold money card ${id}.`);
      return card;
    });
    return cards;
  }

  submitOffer(playerId: string, moneyCardIds: string[]): void {
    this.requireActionable();
    const state = this.requireKuhhandel();
    this.requireActivePlayer(playerId);
    if (playerId !== state.initiatorId) {
      throw new Error('Only the initiator submits the first secret offer.');
    }
    const cards = this.resolveOffer(playerId, moneyCardIds);
    this.kuhhandel = submitInitiatorOffer(state, cards, state.tieRound);
    this.runBotLoop();
  }

  respondAccept(playerId: string): void {
    this.requireActionable();
    const state = this.requireKuhhandel();
    if (playerId !== state.targetId) {
      throw new Error('Only the target of the Kuhhandel can respond.');
    }
    const result = engRespondAccept(state);
    this.players = applyKuhhandelResult(this.players, result);
    this.withGameId((gameId) => this.persistence.logEvent(gameId, 'KUHHANDEL_RESOLVED', result));
    this.endTurn();
    this.runBotLoop();
  }

  respondCounter(playerId: string, moneyCardIds: string[]): void {
    this.requireActionable();
    const state = this.requireKuhhandel();
    if (playerId !== state.targetId) {
      throw new Error('Only the target of the Kuhhandel can respond.');
    }
    const cards = this.resolveOffer(playerId, moneyCardIds);
    const result = engRespondCounter(state, cards);

    if (result.type === 'tie_reoffer_needed') {
      this.kuhhandel = { ...state, stage: 'awaiting_initiator_offer', tieRound: result.tieRound };
      return;
    }

    this.players = applyKuhhandelResult(this.players, result);
    this.withGameId((gameId) => this.persistence.logEvent(gameId, 'KUHHANDEL_RESOLVED', result));
    this.endTurn();
    this.runBotLoop();
  }

  getViewFor(viewerId: string): GameStateView {
    const players: PlayerView[] = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      animals: p.animals,
      moneyCount: p.money.length,
      money: p.id === viewerId ? p.money : null,
      score: this.status === 'finished' ? computeScore(p) : null,
      isBot: this.botPlayerIds.has(p.id),
    }));

    return {
      status: this.status,
      players,
      activePlayerId: this.status === 'in_progress' ? this.activePlayer.id : null,
      hostPlayerId: this.hostPlayerId,
      deckCount: this.deck.length,
      auction: this.auction,
      kuhhandel: this.kuhhandel ? getKuhhandelPublicView(this.kuhhandel, viewerId) : null,
    };
  }

  /** Non-sensitive summary for public room listings (no hands, no viewer needed). */
  getSummary(): { playerCount: number; status: RoomStatus } {
    return { playerCount: this.players.length, status: this.status };
  }
}
