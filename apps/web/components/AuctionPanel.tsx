"use client";

import { useGameStore } from "../store/gameStore";
import { getSocket } from "../lib/socket";
import { Button, PlayingCard } from "@kuhhandel/ui";
import styles from "./AuctionPanel.module.css";

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
    <div className={styles.panel}>
      <h3 className={styles.title}>Enchère — {auction.card.species}</h3>
      <p className={styles.ticker}>
        Meilleure offre :{" "}
        {auction.highestBid ? (
          <span className={styles.tickerAmount}>{auction.highestBid.amount}</span>
        ) : (
          "aucune"
        )}
        {auction.highestBid && ` (${auction.highestBid.playerId})`}
      </p>

      {!isSeller && !awaitingSellerDecision && isActiveBidder && (
        <div>
          {/* Bids are cards from your own hand — known with certainty, cf.
              05_UI_UX.md §4 — not an arbitrary typed amount you might not
              actually hold. */}
          <p className={styles.handLabel}>Ta main (montants réels que tu peux miser) :</p>
          <div className={styles.bidRow}>
            {myMoney.map((card) => {
              const disabled = card.value <= currentHighest;
              return (
                <button
                  key={card.id}
                  type="button"
                  className={[styles.bidCard, disabled ? styles.bidCardDisabled : ""]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={disabled}
                  onClick={() => getSocket().emit("auction:bid", { amount: card.value })}
                >
                  <PlayingCard
                    variant="money"
                    label={`Billet ${card.value}`}
                    value={card.value}
                    imageSlot={`bill-${card.value}`}
                    accentColor="var(--kd-accent-yellow)"
                  />
                </button>
              );
            })}
          </div>
          <Button variant="secondary" onClick={() => getSocket().emit("auction:pass")}>
            Passer
          </Button>
        </div>
      )}

      {isSeller && awaitingSellerDecision && (
        <div className={styles.sellerActions}>
          <Button
            variant="primary"
            onClick={() => getSocket().emit("auction:sellerDecision", { decision: "sell" })}
          >
            Vendre
          </Button>
          <Button
            variant="secondary"
            disabled={
              auction.highestBid !== null && !myMoney.some((c) => c.value === auction.highestBid!.amount)
            }
            title="Garder l'animal t'oblige à payer l'enchérisseur ce montant exact — il te faut une carte de cette valeur."
            onClick={() => getSocket().emit("auction:sellerDecision", { decision: "keep" })}
          >
            Garder
          </Button>
        </div>
      )}
    </div>
  );
}
