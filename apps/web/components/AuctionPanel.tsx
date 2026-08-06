"use client";

import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { getSocket } from "../lib/socket";
import { Button, PlayingCard } from "@kuhhandel/ui";
import { SPECIES_LABEL } from "../lib/species";
import { registerCardPosition } from "../lib/cardPositions";
import styles from "./AuctionPanel.module.css";

export function AuctionPanel() {
  const state = useGameStore((s) => s.state);
  const playerId = useGameStore((s) => s.playerId);
  const [selectedBidIds, setSelectedBidIds] = useState<string[]>([]);
  const [composingKeep, setComposingKeep] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const auction = state?.auction;
  if (!auction || !playerId) return null;

  const isSeller = auction.sellerId === playerId;
  const isActiveBidder = auction.activeBidders.includes(playerId);
  const isLeading = auction.highestBid?.playerId === playerId;
  const awaitingSellerDecision = auction.status === "awaiting_seller_decision";
  const myMoney = state!.players.find((p) => p.id === playerId)?.money ?? [];
  const currentHighest = auction.highestBid?.amount ?? -1;
  const selectedTotal = myMoney
    .filter((c) => selectedBidIds.includes(c.id))
    .reduce((sum, c) => sum + c.value, 0);

  const selectedPaymentTotal = myMoney
    .filter((c) => selectedPaymentIds.includes(c.id))
    .reduce((sum, c) => sum + c.value, 0);

  function toggleBidCard(cardId: string) {
    setSelectedBidIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId],
    );
  }

  function submitBid() {
    getSocket().emit("auction:bid", { moneyCardIds: selectedBidIds });
    setSelectedBidIds([]);
  }

  function togglePaymentCard(cardId: string) {
    setSelectedPaymentIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId],
    );
  }

  function confirmKeep() {
    getSocket().emit("auction:sellerDecision", { decision: "keep", paymentCardIds: selectedPaymentIds });
    setComposingKeep(false);
    setSelectedPaymentIds([]);
  }

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Enchère — {SPECIES_LABEL[auction.card.species]}</h3>
      <p className={styles.ticker}>
        Meilleure offre :{" "}
        {auction.highestBid ? (
          <span className={styles.tickerAmount}>{auction.highestBid.amount}</span>
        ) : (
          "aucune"
        )}
        {auction.highestBid &&
          ` (${state!.players.find((p) => p.id === auction.highestBid!.playerId)?.name ?? "?"})`}
      </p>

      {isLeading && !awaitingSellerDecision && (
        <p className={styles.leadingState}>
          Vous menez l'enchère à {currentHighest} — en attente des autres joueurs.
        </p>
      )}

      {!isSeller && !isLeading && !awaitingSellerDecision && isActiveBidder && (
        <div>
          {/* Bids are combined from cards in your own hand — known with
              certainty, cf. 05_UI_UX.md §4 — not an arbitrary typed
              amount you might not actually hold. */}
          <p className={styles.handLabel}>
            Ta main — sélectionne un ou plusieurs billets (total : {selectedTotal}) :
          </p>
          <div className={styles.bidRow}>
            {myMoney.map((card) => {
              const isSelected = selectedBidIds.includes(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  ref={(el) => registerCardPosition(card.id, el)}
                  className={[styles.bidCard, isSelected ? styles.bidCardSelected : ""]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={isSelected}
                  onClick={() => toggleBidCard(card.id)}
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
          <div className={styles.bidActions}>
            <Button
              variant="primary"
              disabled={selectedTotal <= currentHighest}
              onClick={submitBid}
            >
              Enchérir ({selectedTotal})
            </Button>
            <Button variant="secondary" onClick={() => getSocket().emit("auction:pass")}>
              Passer
            </Button>
          </div>
        </div>
      )}

      {isSeller && awaitingSellerDecision && !composingKeep && (
        <div className={styles.sellerActions}>
          <Button
            variant="primary"
            onClick={() => getSocket().emit("auction:sellerDecision", { decision: "sell" })}
          >
            Vendre
          </Button>
          <Button
            variant="secondary"
            onClick={() => setComposingKeep(true)}
          >
            Garder
          </Button>
        </div>
      )}

      {isSeller && awaitingSellerDecision && composingKeep && (
        <div>
          <p className={styles.handLabel}>
            Choisis des billets sommant exactement à {currentHighest} pour garder l'animal (total
            sélectionné : {selectedPaymentTotal}) :
          </p>
          <div className={styles.bidRow}>
            {myMoney.map((card) => {
              const isSelected = selectedPaymentIds.includes(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  className={[styles.bidCard, isSelected ? styles.bidCardSelected : ""]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={isSelected}
                  onClick={() => togglePaymentCard(card.id)}
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
          <div className={styles.bidActions}>
            <Button
              variant="primary"
              disabled={selectedPaymentTotal !== currentHighest}
              onClick={confirmKeep}
            >
              Confirmer ({selectedPaymentTotal} / {currentHighest})
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setComposingKeep(false);
                setSelectedPaymentIds([]);
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
