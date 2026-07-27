"use client";

import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { getSocket } from "../lib/socket";

export function AuctionPanel() {
  const state = useGameStore((s) => s.state);
  const playerId = useGameStore((s) => s.playerId);
  const [amount, setAmount] = useState(10);
  const auction = state?.auction;
  if (!auction || !playerId) return null;

  const isSeller = auction.sellerId === playerId;
  const isActiveBidder = auction.activeBidders.includes(playerId);
  const awaitingSellerDecision = auction.status === "awaiting_seller_decision";

  return (
    <div>
      <h3>Enchère — {auction.card.species}</h3>
      <p>
        Meilleure offre :{" "}
        {auction.highestBid ? `${auction.highestBid.amount} (${auction.highestBid.playerId})` : "aucune"}
      </p>

      {!isSeller && !awaitingSellerDecision && isActiveBidder && (
        <div>
          <input
            type="number"
            value={amount}
            min={0}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <button onClick={() => getSocket().emit("auction:bid", { amount })}>Enchérir</button>
          <button onClick={() => getSocket().emit("auction:pass")}>Passer</button>
        </div>
      )}

      {isSeller && awaitingSellerDecision && (
        <div>
          <button onClick={() => getSocket().emit("auction:sellerDecision", { decision: "sell" })}>
            Vendre
          </button>
          <button onClick={() => getSocket().emit("auction:sellerDecision", { decision: "keep" })}>
            Garder
          </button>
        </div>
      )}
    </div>
  );
}
