import {
  SPECIES_FAMILY_VALUE,
  SPECIES_KEYS,
  CARDS_PER_SPECIES,
  computeScore,
  type AnimalCard,
  type AuctionResult,
  type KuhhandelResult,
  type Player,
  type SpeciesKey,
} from "@kuhhandel/game-engine";
import type { GameSummary } from "@kuhhandel/meta-engine";
import type { PlayerDistinctionFacts } from "@kuhhandel/distinctions-engine";

const TOTAL_DECK_SIZE = SPECIES_KEYS.length * CARDS_PER_SPECIES;

interface PerPlayerStats {
  currentAuctionBidCount: number;
  maxConsecutiveBidRoundsWithoutWinning: number;
  totalMoneyCollected: number;
  maxOverpayRatio: number;
  hadAllInKuhhandelOffer: boolean;
  kuhhandelsWon: number;
  kuhhandelsLost: number;
  successfulBluffs: number;
  totalBluffs: number;
  currentKuhhandelRefusalStreak: number;
  maxConsecutiveKuhhandelRefusals: number;
  completedFamilyOnFinalTurn: boolean;
  /** Hall of Fame/Shame facts (08_AI.md §3), gathered alongside the meta-progression stats above. */
  kuhhandelWinStakes: number[];
  maxBluffGap: number;
  maxArnaqueRatio: number;
}

function emptyStats(): PerPlayerStats {
  return {
    currentAuctionBidCount: 0,
    maxConsecutiveBidRoundsWithoutWinning: 0,
    totalMoneyCollected: 0,
    maxOverpayRatio: 0,
    hadAllInKuhhandelOffer: false,
    kuhhandelsWon: 0,
    kuhhandelsLost: 0,
    successfulBluffs: 0,
    totalBluffs: 0,
    currentKuhhandelRefusalStreak: 0,
    maxConsecutiveKuhhandelRefusals: 0,
    completedFamilyOnFinalTurn: false,
    kuhhandelWinStakes: [],
    maxBluffGap: 0,
    maxArnaqueRatio: 0,
  };
}

function estimatedCardValue(species: SpeciesKey): number {
  return SPECIES_FAMILY_VALUE[species] / CARDS_PER_SPECIES;
}

function hasCompleteFamily(animals: AnimalCard[], species: SpeciesKey): boolean {
  return animals.filter((a) => a.species === species).length >= CARDS_PER_SPECIES;
}

/**
 * Observes GameRoom's play-by-play to build the per-player GameSummary
 * that packages/meta-engine needs at game end. Lives here (not in the pure
 * game-engine) because it's an observational side-channel over the rules,
 * not a rule itself.
 */
export class GameStatsTracker {
  private stats = new Map<string, PerPlayerStats>();
  private lastLeaderCheckpoint: { leaderId: string; margin: number } | null = null;
  /** One-time snapshot of each player's rank near the game's midpoint, for the "comeback" distinction. */
  private midGameRanks: Map<string, number> | null = null;

  private get(playerId: string): PerPlayerStats {
    let s = this.stats.get(playerId);
    if (!s) {
      s = emptyStats();
      this.stats.set(playerId, s);
    }
    return s;
  }

  onBid(playerId: string): void {
    this.get(playerId).currentAuctionBidCount += 1;
  }

  onAuctionResolved(result: AuctionResult, sellerId: string, allBidderIds: string[]): void {
    for (const bidderId of allBidderIds) {
      const s = this.get(bidderId);
      const wonThisAuction = result.cardGoesTo === bidderId;
      if (!wonThisAuction) {
        s.maxConsecutiveBidRoundsWithoutWinning = Math.max(
          s.maxConsecutiveBidRoundsWithoutWinning,
          s.currentAuctionBidCount,
        );
      }
      s.currentAuctionBidCount = 0;
    }
    this.get(sellerId).currentAuctionBidCount = 0;

    if (result.payment) {
      const { from, to, amount } = result.payment;
      if (to === sellerId) {
        this.get(sellerId).totalMoneyCollected += amount;
      }
      const estimated = estimatedCardValue(result.card.species);
      if (estimated > 0) {
        const ratio = amount / estimated;
        const buyer = this.get(from);
        buyer.maxOverpayRatio = Math.max(buyer.maxOverpayRatio, ratio);
      }
    }
  }

  onKuhhandelOfferSubmitted(playerId: string, offerTotal: number, moneyBeforeOffer: number): void {
    if (moneyBeforeOffer > 0 && offerTotal >= moneyBeforeOffer) {
      this.get(playerId).hadAllInKuhhandelOffer = true;
    }
  }

  onKuhhandelCountered(targetId: string): void {
    const s = this.get(targetId);
    s.currentKuhhandelRefusalStreak += 1;
    s.maxConsecutiveKuhhandelRefusals = Math.max(
      s.maxConsecutiveKuhhandelRefusals,
      s.currentKuhhandelRefusalStreak,
    );
  }

  onKuhhandelAccepted(
    initiatorId: string,
    targetId: string,
    species: SpeciesKey,
    offerTotal: number,
  ): void {
    this.get(targetId).currentKuhhandelRefusalStreak = 0;
    const winner = this.get(initiatorId);
    winner.kuhhandelsWon += 1;
    winner.kuhhandelWinStakes.push(offerTotal);
    const arnaqueRatio = estimatedCardValue(species) / Math.max(offerTotal, 1);
    winner.maxArnaqueRatio = Math.max(winner.maxArnaqueRatio, arnaqueRatio);
  }

  onKuhhandelCounterResolved(
    result: Extract<KuhhandelResult, { type: "counter_resolved" | "tie_default_initiator_wins" }>,
    initiatorId: string,
    targetId: string,
    initiatorOfferTotal: number,
    targetOfferTotal: number,
  ): void {
    this.get(targetId).currentKuhhandelRefusalStreak = 0;
    const winner = this.get(result.winnerId);
    const loser = this.get(result.loserId);
    winner.kuhhandelsWon += 1;
    loser.kuhhandelsLost += 1;

    winner.totalBluffs += 1;
    const winnerStake = result.winnerId === initiatorId ? initiatorOfferTotal : targetOfferTotal;
    const loserStake = result.winnerId === initiatorId ? targetOfferTotal : initiatorOfferTotal;
    if (winnerStake < loserStake) {
      winner.successfulBluffs += 1;
      winner.maxBluffGap = Math.max(winner.maxBluffGap, loserStake - winnerStake);
    }

    winner.kuhhandelWinStakes.push(winnerStake);
    const arnaqueRatio = estimatedCardValue(result.species) / Math.max(winnerStake, 1);
    winner.maxArnaqueRatio = Math.max(winner.maxArnaqueRatio, arnaqueRatio);
  }

  /**
   * Call after every turn ends, to checkpoint who's leading for the "lost
   * after leading" achievement, and to snapshot each player's rank near
   * the game's midpoint for the "comeback" Hall of Fame distinction
   * (08_AI.md §3). `deckRemaining` lets the snapshot fire once, the first
   * time the deck crosses its halfway point.
   */
  recordLeaderCheckpoint(players: Player[], deckRemaining: number): void {
    const scored = players
      .map((p) => ({ id: p.id, score: computeScore(p) }))
      .sort((a, b) => b.score - a.score);
    const leader = scored[0]!;
    const runnerUp = scored[1];
    const margin = leader.score - (runnerUp?.score ?? 0);
    this.lastLeaderCheckpoint = { leaderId: leader.id, margin };

    if (!this.midGameRanks && deckRemaining <= TOTAL_DECK_SIZE / 2) {
      this.midGameRanks = new Map(scored.map((s, index) => [s.id, index + 1]));
    }
  }

  onFinalCardResolved(buyerId: string, species: SpeciesKey, buyerAnimalsAfter: AnimalCard[]): void {
    if (hasCompleteFamily(buyerAnimalsAfter, species)) {
      this.get(buyerId).completedFamilyOnFinalTurn = true;
    }
  }

  buildSummaries(
    players: Player[],
    winnerIds: Set<string>,
    /** margin threshold above which a checkpoint lead counts as "largely in the lead" */
    leadingMarginThreshold = 300,
  ): Map<string, GameSummary> {
    const summaries = new Map<string, GameSummary>();
    for (const player of players) {
      const s = this.get(player.id);
      const won = winnerIds.has(player.id);
      const lostAfterLeading =
        !won &&
        this.lastLeaderCheckpoint?.leaderId === player.id &&
        this.lastLeaderCheckpoint.margin >= leadingMarginThreshold;

      summaries.set(player.id, {
        won,
        score: computeScore(player),
        finalMoney: player.money.reduce((sum, c) => sum + c.value, 0),
        familiesCompletedThisGame: [...new Set(player.animals.map((a) => a.species))].filter((sp) =>
          hasCompleteFamily(player.animals, sp),
        ),
        completedFamilyOnFinalTurn: s.completedFamilyOnFinalTurn,
        maxConsecutiveBidRoundsWithoutWinning: s.maxConsecutiveBidRoundsWithoutWinning,
        totalMoneyCollectedThisGame: s.totalMoneyCollected,
        maxOverpayRatio: s.maxOverpayRatio,
        hadAllInKuhhandelOffer: s.hadAllInKuhhandelOffer,
        kuhhandelsWonThisGame: s.kuhhandelsWon,
        kuhhandelsLostThisGame: s.kuhhandelsLost,
        successfulBluffsThisGame: s.successfulBluffs,
        totalBluffsThisGame: s.totalBluffs,
        lostAfterLeading: Boolean(lostAfterLeading),
        maxConsecutiveKuhhandelRefusalsThisGame: s.maxConsecutiveKuhhandelRefusals,
        wasLastConnectedAfterGame: false,
      });
    }
    return summaries;
  }

  /** Facts for @kuhhandel/distinctions-engine's computeDistinctions, gathered at game end. */
  buildHallOfFameFacts(players: Player[]): PlayerDistinctionFacts[] {
    const finalRankByPlayer = new Map(
      players
        .map((p) => ({ id: p.id, score: computeScore(p) }))
        .sort((a, b) => b.score - a.score)
        .map((s, index) => [s.id, index + 1]),
    );

    return players.map((player) => {
      const s = this.get(player.id);
      const midRank = this.midGameRanks?.get(player.id);
      const finalRank = finalRankByPlayer.get(player.id)!;
      const avgKuhhandelWinStake =
        s.kuhhandelWinStakes.length > 0
          ? s.kuhhandelWinStakes.reduce((a, b) => a + b, 0) / s.kuhhandelWinStakes.length
          : 0;

      return {
        playerId: player.id,
        maxBluffGap: s.maxBluffGap,
        maxArnaqueRatio: s.maxArnaqueRatio,
        maxOverpayRatio: s.maxOverpayRatio,
        comebackDelta: midRank !== undefined ? midRank - finalRank : 0,
        kuhhandelWinsCount: s.kuhhandelsWon,
        avgKuhhandelWinStake,
      };
    });
  }
}
