import {
  CARDS_PER_SPECIES,
  SPECIES_FAMILY_VALUE,
  type AnimalCard,
  type AuctionState,
  type KuhhandelState,
  type MoneyCard,
  type Player,
  type RandomSource,
  type SpeciesKey,
} from "@kuhhandel/game-engine";
import type { BotConfig } from "./config.js";
import { selectCardsForAmount, totalValue } from "./money.js";

function ownedCount(animals: AnimalCard[], species: SpeciesKey): number {
  return animals.filter((a) => a.species === species).length;
}

/**
 * Rough perceived value of one more card of `species` for this bot: the
 * per-card share of the family's value, boosted the closer the bot already
 * is to completing the family (08_AI.md §2: "estimation de la valeur
 * restante de l'espèce").
 */
function estimatedCardValue(animals: AnimalCard[], species: SpeciesKey): number {
  const perCard = SPECIES_FAMILY_VALUE[species] / CARDS_PER_SPECIES;
  const owned = ownedCount(animals, species);
  return perCard * (1 + owned / CARDS_PER_SPECIES);
}

function jitter(amount: number, riskTolerance: number, rng: RandomSource): number {
  const variance = amount * riskTolerance * (rng() * 2 - 1);
  return Math.max(0, Math.round(amount + variance));
}

/**
 * Returns the next bid amount (or null to pass). A bid must be an exact
 * denomination the bot actually holds — the engine settles auction
 * payments with a single matching card (packages/game-engine/src/engine/
 * applyResults.ts), so a bot can never offer an amount it can't pay.
 */
export function decideAuctionBid(
  bot: Player,
  state: AuctionState,
  config: BotConfig,
  rng: RandomSource,
): number | null {
  const estimate = estimatedCardValue(bot.animals, state.card.species);
  const cash = totalValue(bot.money);
  const budget = jitter(Math.min(estimate, cash * config.aggressiveness), config.riskTolerance, rng);
  const currentHighest = state.highestBid?.amount ?? -1;

  const affordableRaises = bot.money
    .map((c) => c.value)
    // 0-value cards exist only to bluff in a secret Kuhhandel offer
    // (money.config.ts) — never a meaningful real auction bid.
    .filter((value) => value > 0 && value > currentHighest && value <= budget)
    .sort((a, b) => a - b);

  return affordableRaises[0] ?? null;
}

/**
 * The seller sells whenever the highest bid clears their own estimate of
 * the card. "Keep" requires paying the bidder the bid amount out of the
 * seller's own hand (packages/game-engine/src/engine/applyResults.ts
 * settles both outcomes with a single exact-value card) — a bot can only
 * choose "keep" when it actually holds a matching card, otherwise it must
 * sell regardless of how the price compares to its estimate.
 */
export function decideSellerDecision(
  seller: Player,
  state: AuctionState,
  config: BotConfig,
): "sell" | "keep" {
  if (!state.highestBid) return "sell";
  const canAffordToKeep = seller.money.some((c) => c.value === state.highestBid!.amount);
  if (!canAffordToKeep) return "sell";
  const estimate = estimatedCardValue(seller.animals, state.card.species);
  return state.highestBid.amount >= estimate * config.aggressiveness ? "sell" : "keep";
}

/**
 * Looks for a Kuhhandel worth starting: the bot must hold a duplicate of a
 * species another player also holds, and estimate having a cash advantage
 * over that player (08_AI.md §2).
 */
export function decideKuhhandelInitiation(
  bot: Player,
  otherPlayers: Player[],
  config: BotConfig,
): { targetId: string; species: SpeciesKey } | null {
  const botCash = totalValue(bot.money);
  const duplicateSpecies = [...new Set(bot.animals.map((a) => a.species))].filter(
    (species) => ownedCount(bot.animals, species) >= 2,
  );

  for (const species of duplicateSpecies) {
    for (const other of otherPlayers) {
      if (!other.animals.some((a) => a.species === species)) continue;
      const otherCash = totalValue(other.money);
      if (botCash >= otherCash * (1 - config.aggressiveness * 0.5)) {
        return { targetId: other.id, species };
      }
    }
  }
  return null;
}

/**
 * Composes a secret offer: a bounded random share of the bot's cash, with
 * variance so it isn't perfectly predictable (08_AI.md §2).
 */
export function decideKuhhandelOffer(
  bot: Player,
  config: BotConfig,
  rng: RandomSource,
): MoneyCard[] {
  const cash = totalValue(bot.money);
  const target = jitter(cash * config.aggressiveness, config.riskTolerance, rng);
  return selectCardsForAmount(bot.money, target);
}

/**
 * Response to an incoming Kuhhandel as the target: accept if the implied
 * split looks fair enough, otherwise counter with the bot's own offer.
 * (The initiator's offer stays secret until reveal, so the target can only
 * decide based on its own hand/estimate, never the initiator's actual cards.)
 */
export function decideKuhhandelResponse(
  target: Player,
  state: KuhhandelState,
  config: BotConfig,
  rng: RandomSource,
): { type: "accept" } | { type: "counter"; cards: MoneyCard[] } {
  const estimate = estimatedCardValue(target.animals, state.species);
  const cash = totalValue(target.money);
  const comfortable = cash * config.aggressiveness;

  if (estimate <= comfortable * 0.5) {
    return { type: "accept" };
  }
  return { type: "counter", cards: decideKuhhandelOffer(target, config, rng) };
}
