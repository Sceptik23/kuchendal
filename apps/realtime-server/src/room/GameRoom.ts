import {
  MIN_PLAYERS,
  MAX_PLAYERS,
  createShuffledDeck,
  createMoneyBank,
  dealStartingMoney,
  computeScore,
  isGameOver,
  isDeckExhausted,
  hasIncompleteFamilyAnimal,
  isGoldenDonkeyCard,
  distributeGoldenDonkeyBonus,
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
  GamePhase,
  KuhhandelState,
  MoneyBank,
  MoneyCard,
  Player,
  RandomSource,
  SellerDecision,
  SpeciesKey,
} from '@kuhhandel/game-engine';
import type { GameStateView, PlayerView, RoomStatus } from '@kuhhandel/shared-types';
import { NullPersistenceAdapter, type GamePersistenceAdapter } from '../persistence/types.js';
import { GameStatsTracker } from './GameStatsTracker.js';
import { awardGameProgress } from '../meta/awardGameProgress.js';
import {
  SPECIES_FAMILY_VALUE,
  STARTING_MONEY,
  KUHHANDEL_TIE_BREAK_MAX_ROUNDS,
  NO_BID_SELLER_KEEPS_FREE,
  GAME_END_CONDITION,
  REMAINING_MONEY_COUNTS_IN_SCORE,
} from '@kuhhandel/game-engine';
import {
  BOT_DIFFICULTY_PRESETS,
  decideAuctionBid,
  decideKuhhandelInitiation,
  decideKuhhandelOffer,
  decideKuhhandelResponse,
  decideSellerDecision,
  type BotDifficulty,
} from '@kuhhandel/bot-engine';
import {
  TemplateNarratorProvider,
  isBigBid,
  isBluffRevealed,
  isBoldKuhhandelOffer,
  isComeback,
  type NarratorMessage,
  type NarratorProvider,
  type NarratorStyle,
} from '@kuhhandel/narrator-engine';
import { computeDistinctions, type DistinctionEntry } from '@kuhhandel/distinctions-engine';
import { rollRareEvent, type RareEventEntry } from '@kuhhandel/rare-events-engine';

const NARRATOR_FEED_LIMIT = 20;
const RARE_EVENTS_FEED_LIMIT = 20;

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
  private botDifficultyByPlayerId = new Map<string, BotDifficulty>();
  private hostPlayerId: string | null = null;
  private gameIdPromise: Promise<string> | null = null;
  private botCounter = 0;
  private turnNumber = 0;
  private statsTracker = new GameStatsTracker();
  private currentAuctionBidderIds: string[] = [];
  private narratorFeed: NarratorMessage[] = [];
  private lastNarratorLeaderId: string | null = null;
  private finalDistinctions: DistinctionEntry[] = [];
  private rareEventsFeed: RareEventEntry[] = [];
  private moneyBank: MoneyBank = createMoneyBank();
  private phase: GamePhase = 'AUCTION_FLOW';
  private donkeyRevealCount = 0;

  constructor(
    private readonly rng: RandomSource = Math.random,
    private readonly startingMoneyFactory: (
      bank: MoneyBank,
      playerCount: number,
    ) => { bank: MoneyBank; hands: MoneyCard[][] } = dealStartingMoney,
    private readonly persistence: GamePersistenceAdapter = new NullPersistenceAdapter(),
    private readonly narratorStyle: NarratorStyle = 'sport',
    private readonly narratorProvider: NarratorProvider = new TemplateNarratorProvider(rng),
    private readonly deckFactory: () => AnimalCard[] = () => createShuffledDeck(rng),
  ) {}

  private botConfig(playerId: string) {
    return BOT_DIFFICULTY_PRESETS[this.botDifficultyByPlayerId.get(playerId) ?? 'normal'];
  }

  private emitNarratorEvent(
    eventKey: Parameters<NarratorProvider['comment']>[1],
    placeholders: Parameters<NarratorProvider['comment']>[2],
  ): void {
    const message = this.narratorProvider.comment(this.narratorStyle, eventKey, placeholders);
    if (!message) return;
    this.narratorFeed.push(message);
    if (this.narratorFeed.length > NARRATOR_FEED_LIMIT) this.narratorFeed.shift();
  }

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
   * complete the table), with a difficulty preset (08_AI.md §2) driving
   * its heuristic decisions in runBotLoop below.
   */
  addBot(requesterId: string, difficulty: BotDifficulty = 'normal'): string {
    this.requireHost(requesterId);
    if (this.status !== 'lobby') {
      throw new Error('Cannot add a bot once the game has started.');
    }
    this.botCounter += 1;
    const id = this.join(`Bot ${this.botCounter}`, null, true);
    this.botDifficultyByPlayerId.set(id, difficulty);
    return id;
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
    this.botDifficultyByPlayerId.delete(targetId);
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
    this.deck = this.deckFactory();
    const { bank, hands } = this.startingMoneyFactory(this.moneyBank, this.players.length);
    this.moneyBank = bank;
    this.players = this.players.map((p, i) => ({ ...p, money: hands[i]! }));
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
   * Drives every bot player using the heuristics of 08_AI.md §2 (packages/
   * bot-engine): estimates species value from what's left to complete a
   * family, bids/offers a bounded, slightly randomized share of its cash,
   * and only initiates a Kuhhandel when it holds a duplicate and looks
   * cash-advantaged over the target. Called after every state-changing
   * action so a chain of bot turns plays itself out without any external
   * trigger.
   */
  private runBotLoop(): void {
    if (this.status !== 'in_progress') return;

    if (this.kuhhandel) {
      const state = this.kuhhandel;
      if (state.stage === 'awaiting_initiator_offer' && this.botPlayerIds.has(state.initiatorId)) {
        const initiator = this.findPlayer(state.initiatorId);
        const offer = decideKuhhandelOffer(initiator, this.botConfig(initiator.id), this.rng);
        this.submitOffer(initiator.id, offer.map((c) => c.id));
        return;
      }
      if (state.stage === 'awaiting_response' && this.botPlayerIds.has(state.targetId)) {
        const target = this.findPlayer(state.targetId);
        const response = decideKuhhandelResponse(target, state, this.botConfig(target.id), this.rng);
        if (response.type === 'accept') {
          this.respondAccept(target.id);
        } else {
          this.respondCounter(target.id, response.cards.map((c) => c.id));
        }
      }
      return;
    }

    if (this.auction) {
      const state = this.auction;
      if (state.status === 'bidding') {
        // Never let a bot react to its own bid: it has nothing new to
        // respond to, and re-triggering it here would let it bid against
        // itself in a synchronous loop, closing the auction before any
        // other active bidder (a human, or another bot) ever gets a turn.
        const botBidder = state.activeBidders.find(
          (id) => this.botPlayerIds.has(id) && id !== state.highestBid?.playerId,
        );
        if (botBidder) {
          const bot = this.findPlayer(botBidder);
          const bid = decideAuctionBid(bot, state, this.botConfig(botBidder), this.rng);
          if (bid === null) {
            this.pass(botBidder);
          } else {
            this.placeBid(botBidder, bid);
          }
        }
        return;
      }
      if (state.status === 'awaiting_seller_decision' && this.botPlayerIds.has(state.sellerId)) {
        const seller = this.findPlayer(state.sellerId);
        const decision = decideSellerDecision(seller, state, this.botConfig(state.sellerId));
        this.sellerDecision(state.sellerId, decision);
      }
      return;
    }

    if (this.botPlayerIds.has(this.activePlayer.id)) {
      const bot = this.activePlayer;
      const others = this.players.filter((p) => p.id !== bot.id);
      const kuhhandel = decideKuhhandelInitiation(bot, others, this.botConfig(bot.id));
      if (kuhhandel) {
        this.startKuhhandel(bot.id, kuhhandel.targetId, kuhhandel.species);
      } else if (this.phase === 'FORCED_KUHHANDEL') {
        const forced = this.findAnyLegalKuhhandelPartner(bot, others);
        this.startKuhhandel(bot.id, forced.targetId, forced.species);
      } else {
        this.startAuction(bot.id);
      }
    }
  }

  /**
   * During FORCED_KUHHANDEL, startAuction is illegal (the deck is empty), so a bot
   * whose heuristic decideKuhhandelInitiation returns null (it was tuned for the
   * NORMAL phase, where "no good trade" can fall back to an auction) must still find
   * SOME legal Kuhhandel to start. The auto-pass loop in endTurn only leaves a bot as
   * activePlayer during FORCED_KUHHANDEL if that bot holds an incomplete family, which
   * by definition means some other player holds at least one animal of that species —
   * so a legal partner is guaranteed to exist.
   */
  private findAnyLegalKuhhandelPartner(
    bot: Player,
    others: Player[],
  ): { targetId: string; species: SpeciesKey } {
    for (const animal of bot.animals) {
      for (const other of others) {
        if (canInitiateKuhhandel(bot.animals, other.animals, animal.species)) {
          return { targetId: other.id, species: animal.species };
        }
      }
    }
    throw new Error(
      'Internal invariant violated: no legal Kuhhandel partner found during FORCED_KUHHANDEL.',
    );
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

    if (isDeckExhausted(this.deck)) {
      this.phase = 'FORCED_KUHHANDEL';
    }

    if (isGameOver(this.players)) {
      this.finishGame();
      return;
    }

    this.statsTracker.recordLeaderCheckpoint(this.players, this.deck.length);
    const scored = this.players
      .map((p) => ({ id: p.id, score: computeScore(p) }))
      .sort((a, b) => b.score - a.score);
    const newLeaderId = scored[0]!.id;
    if (isComeback(this.lastNarratorLeaderId, newLeaderId)) {
      this.emitNarratorEvent('comeback', { player: this.findPlayer(newLeaderId).name });
    }
    this.lastNarratorLeaderId = newLeaderId;

    // Purely cosmetic (06_AUDIO_VFX.md §4 / 07_META_GAME.md §6): never
    // touches this.players or scoring, only the display feed below.
    const rareEvent = rollRareEvent(this.rng);
    if (rareEvent) {
      this.rareEventsFeed.push(rareEvent);
      if (this.rareEventsFeed.length > RARE_EVENTS_FEED_LIMIT) this.rareEventsFeed.shift();
    }

    this.activePlayerIndex = nextPlayerIndex(this.activePlayerIndex, this.players.length);
    // Rulebook: once Kuhhandel is mandatory, a player holding only complete
    // families (or nothing) cannot participate and must pass automatically.
    while (this.phase === 'FORCED_KUHHANDEL' && !hasIncompleteFamilyAnimal(this.activePlayer.animals)) {
      this.activePlayerIndex = nextPlayerIndex(this.activePlayerIndex, this.players.length);
    }

    this.turnNumber += 1;
    this.withGameId((gameId) =>
      this.persistence.saveSnapshot(gameId, this.turnNumber, {
        players: this.players,
        deck: this.deck,
        activePlayerIndex: this.activePlayerIndex,
      }),
    );
  }

  private finishGame(): void {
    this.phase = 'GAME_OVER';
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

    const topScore = scored[0]!.score;
    const winnerIds = new Set(scored.filter((s) => s.score === topScore).map((s) => s.playerId));
    const summaries = this.statsTracker.buildSummaries(this.players, winnerIds);
    for (const player of this.players) {
      const userId = this.userIdByPlayerId.get(player.id);
      if (!userId) continue; // guests/bots have no cross-game progression
      const summary = summaries.get(player.id);
      if (!summary) continue;
      awardGameProgress(this.persistence, userId, summary).catch((error: unknown) =>
        console.error('[meta]', error),
      );
    }

    const facts = this.statsTracker.buildHallOfFameFacts(this.players);
    this.finalDistinctions = computeDistinctions(facts);
    this.withGameId((gameId) =>
      this.persistence.saveHallOfFameShameEntries(
        gameId,
        this.finalDistinctions.map((entry) => ({
          userId: this.userIdByPlayerId.get(entry.playerId) ?? null,
          distinctionKey: entry.key,
          metricValue: entry.metricValue,
        })),
      ),
    );
  }

  startAuction(playerId: string): void {
    this.requireActionable();
    this.requireActivePlayer(playerId);
    if (this.auction || this.kuhhandel) {
      throw new Error('A flow is already in progress this turn.');
    }
    if (isDeckExhausted(this.deck)) {
      throw new Error('The deck is empty, no card left to auction — Kuhhandel is now mandatory.');
    }
    const card = this.deck[0]!;
    this.deck = this.deck.slice(1);

    if (isGoldenDonkeyCard(card)) {
      // Safe to run after the deck mutation above: distributeGoldenDonkeyBonus
      // draws via drawFromBankWithFallback, which never throws even when the
      // shared 55-card bank is completely exhausted (worst case at 6 players ×
      // 4 donkey reveals). A throw here would leave the room permanently wedged
      // with the card already removed from the deck and no auction started.
      const { bank, players } = distributeGoldenDonkeyBonus(this.moneyBank, this.players, this.donkeyRevealCount);
      this.moneyBank = bank;
      this.players = players;
      this.donkeyRevealCount += 1;
    }

    const otherIds = this.players.filter((p) => p.id !== playerId).map((p) => p.id);
    this.currentAuctionBidderIds = otherIds;
    this.auction = startAuction(card, playerId, otherIds);
    this.runBotLoop();
  }

  private requireAuction(): AuctionState {
    if (!this.auction) throw new Error('No auction is currently in progress.');
    return this.auction;
  }

  placeBid(playerId: string, moneyCardIds: string[]): void {
    this.requireActionable();
    const state = this.requireAuction();
    const cards = this.resolveOffer(playerId, moneyCardIds);
    this.auction = engPlaceBid(state, playerId, cards);
    this.statsTracker.onBid(playerId);
    const amount = this.auction.highestBid!.amount;
    if (isBigBid(amount)) {
      this.emitNarratorEvent('bigBid', {
        player: this.findPlayer(playerId).name,
        amount,
        species: state.card.species,
      });
    }
    this.runBotLoop();
  }

  pass(playerId: string): void {
    this.requireActionable();
    this.auction = engPass(this.requireAuction(), playerId);
    this.runBotLoop();
  }

  sellerDecision(playerId: string, decision: SellerDecision, paymentCardIds?: string[]): void {
    this.requireActionable();
    this.requireActivePlayer(playerId);
    const auctionState = this.requireAuction();
    const sellerPaymentCards =
      decision === 'keep' && paymentCardIds ? this.resolveOffer(playerId, paymentCardIds) : undefined;
    const result = resolveAuction(auctionState, decision, sellerPaymentCards);
    this.players = applyAuctionResult(this.players, result);
    this.statsTracker.onAuctionResolved(result, playerId, this.currentAuctionBidderIds);
    if (isDeckExhausted(this.deck)) {
      const buyer = this.findPlayer(result.cardGoesTo);
      this.statsTracker.onFinalCardResolved(buyer.id, result.card.species, buyer.animals);
    }
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
    this.kuhhandel = startKuhhandel(initiatorId, targetId, species, initiator.animals, target.animals);
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
    const offerTotal = cards.reduce((sum, c) => sum + c.value, 0);
    const moneyBeforeOffer = this.findPlayer(playerId).money.reduce((sum, c) => sum + c.value, 0);
    this.statsTracker.onKuhhandelOfferSubmitted(playerId, offerTotal, moneyBeforeOffer);
    if (isBoldKuhhandelOffer(offerTotal, moneyBeforeOffer)) {
      this.emitNarratorEvent('boldKuhhandel', {
        player: this.findPlayer(playerId).name,
        opponent: this.findPlayer(state.targetId).name,
      });
    }
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
    const offerTotal = result.money.reduce((sum, c) => sum + c.value, 0);
    this.players = applyKuhhandelResult(this.players, result);
    this.statsTracker.onKuhhandelAccepted(state.initiatorId, state.targetId, state.species, offerTotal);
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
    this.statsTracker.onKuhhandelCountered(playerId);
    const result = engRespondCounter(state, cards);

    if (result.type === 'tie_reoffer_needed') {
      this.kuhhandel = { ...state, stage: 'awaiting_initiator_offer', tieRound: result.tieRound };
      this.runBotLoop();
      return;
    }
    if (result.type === 'accept') {
      throw new Error('Unreachable: respondCounter never resolves via accept.');
    }

    const initiatorOfferTotal = (state.initiatorOffer ?? []).reduce((sum, c) => sum + c.value, 0);
    const targetOfferTotal = cards.reduce((sum, c) => sum + c.value, 0);
    this.statsTracker.onKuhhandelCounterResolved(
      result,
      state.initiatorId,
      state.targetId,
      initiatorOfferTotal,
      targetOfferTotal,
    );

    const winnerStake = result.winnerId === state.initiatorId ? initiatorOfferTotal : targetOfferTotal;
    const loserStake = result.winnerId === state.initiatorId ? targetOfferTotal : initiatorOfferTotal;
    if (isBluffRevealed(winnerStake, loserStake)) {
      this.emitNarratorEvent('bluffRevealed', {
        player: this.findPlayer(result.winnerId).name,
        opponent: this.findPlayer(result.loserId).name,
      });
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
      phase: this.phase,
      players,
      activePlayerId: this.status === 'in_progress' ? this.activePlayer.id : null,
      hostPlayerId: this.hostPlayerId,
      deckCount: this.deck.length,
      auction: this.auction,
      kuhhandel: this.kuhhandel ? getKuhhandelPublicView(this.kuhhandel, viewerId) : null,
      narratorFeed: this.narratorFeed,
      distinctions: this.status === 'finished' ? this.finalDistinctions : [],
      rareEventsFeed: this.rareEventsFeed,
      donkeyRevealCount: this.donkeyRevealCount,
    };
  }

  /** Non-sensitive summary for public room listings (no hands, no viewer needed). */
  getSummary(): { playerCount: number; status: RoomStatus } {
    return { playerCount: this.players.length, status: this.status };
  }
}
