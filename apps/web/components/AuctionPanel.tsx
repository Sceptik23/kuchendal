"use client";

import { useGameStore } from "../store/gameStore";
import { getSocket } from "../lib/socket";

export function AuctionPanel() {
  const state = useGameStore((s) => s.state);
  const playerId = useGameStore((s) => s.playerId);
  const auction = state?.auction;
  if (!auction || !playerId) return null;

  const isSeller = auction.sellerId === playerId;
  const isActiveBidder = auction.activeBidders.includes(playerId);
  const awaitingSellerDecision = auction.status === "awaiting_seller_decision";
  const myMoney = state!.players.find((p) => p.id === playerId)?.money ?? [];
  const currentHighest = auction.highestBid?.amount ?? -1;

  return (
    <div>
      <h3>Enchère — {auction.card.species}</h3>
      <p>
        Meilleure offre :{" "}
        {auction.highestBid ? `${auction.highestBid.amount} (${auction.highestBid.playerId})` : "aucune"}
      </p>

      {!isSeller && !awaitingSellerDecision && isActiveBidder && (
        <div>
          {/* Bids are cards from your own hand — known with certainty, cf.
              05_UI_UX.md §4 — not an arbitrary typed amount you might not
              actually hold. */}
          <p>Ta main (montants réels que tu peux miser) :</p>
          <ul>
            {myMoney.map((card) => (
              <li key={card.id}>
                <button
                  disabled={card.value <= currentHighest}
                  onClick={() => getSocket().emit("auction:bid", { amount: card.value })}
                >
                  Enchérir {card.value}
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => getSocket().emit("auction:pass")}>Passer</button>
        </div>
      )}

      {isSeller && awaitingSellerDecision && (
        <div>
          <button onClick={() => getSocket().emit("auction:sellerDecision", { decision: "sell" })}>
            Vendre
          </button>
          <button
            disabled={
              auction.highestBid !== null && !myMoney.some((c) => c.value === auction.highestBid!.amount)
            }
            title="Garder l'animal t'oblige à payer l'enchérisseur ce montant exact — il te faut une carte de cette valeur."
            onClick={() => getSocket().emit("auction:sellerDecision", { decision: "keep" })}
          >
            Garder
          </button>
        </div>
      )}
    </div>
  );
}
