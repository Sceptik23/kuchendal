"use client";

import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { getSocket } from "../lib/socket";
import { Button, InfoStatusIcon, PlayingCard, Select } from "@kuhhandel/ui";
import gameTableStyles from "./GameTable.module.css";
import styles from "./KuhhandelPanel.module.css";

function useOwnMoney() {
  const state = useGameStore((s) => s.state);
  const playerId = useGameStore((s) => s.playerId);
  return state?.players.find((p) => p.id === playerId)?.money ?? [];
}

function MoneyPicker({
  onSubmit,
  label,
}: {
  onSubmit: (cardIds: string[]) => void;
  label: string;
}) {
  const money = useOwnMoney();
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  return (
    <div className={styles.picker}>
      <div className={styles.pickerRow}>
        {money.map((card) => {
          const isSelected = selected.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              className={[styles.moneyToggle, isSelected ? styles.selected : ""]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={isSelected}
              onClick={() => toggle(card.id)}
            >
              <PlayingCard
                variant="money"
                label={`Billet ${card.value}`}
                value={card.value}
                imageSlot={`bill-${card.value}`}
                accentColor="var(--kd-accent-pink)"
              />
            </button>
          );
        })}
      </div>
      <Button variant="primary" onClick={() => onSubmit(selected)}>
        {label}
      </Button>
    </div>
  );
}

export function KuhhandelInitiator() {
  const state = useGameStore((s) => s.state);
  const playerId = useGameStore((s) => s.playerId);
  const [targetId, setTargetId] = useState("");
  const [species, setSpecies] = useState("");
  if (!state || !playerId) return null;

  const me = state.players.find((p) => p.id === playerId)!;
  const mySpecies = new Set(me.animals.map((a) => a.species));
  const otherPlayers = state.players.filter((p) => p.id !== playerId);

  const eligibleTargets = otherPlayers
    .map((p) => ({
      player: p,
      sharedSpecies: p.animals.map((a) => a.species).filter((s) => mySpecies.has(s)),
    }))
    .filter((t) => t.sharedSpecies.length > 0);

  if (eligibleTargets.length === 0) {
    return <p>Aucun Kuhhandel possible pour le moment (aucune espèce en commun).</p>;
  }

  const currentTarget = eligibleTargets.find((t) => t.player.id === targetId) ?? eligibleTargets[0]!;

  return (
    <div className={gameTableStyles.kuhhandelInitiator}>
      <h3 className={gameTableStyles.kuhhandelInitiatorTitle}>Lancer un Kuhhandel</h3>
      <div className={gameTableStyles.kuhhandelInitiatorFields}>
        <Select value={currentTarget.player.id} onChange={(e) => setTargetId(e.target.value)}>
          {eligibleTargets.map((t) => (
            <option key={t.player.id} value={t.player.id}>
              {t.player.name}
            </option>
          ))}
        </Select>
        <Select
          value={species || currentTarget.sharedSpecies[0]}
          onChange={(e) => setSpecies(e.target.value)}
        >
          {[...new Set(currentTarget.sharedSpecies)].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          onClick={() =>
            getSocket().emit("turn:startKuhhandel", {
              targetId: currentTarget.player.id,
              species: species || currentTarget.sharedSpecies[0]!,
            })
          }
        >
          Initier
        </Button>
      </div>
    </div>
  );
}

export function KuhhandelPanel() {
  const state = useGameStore((s) => s.state);
  const playerId = useGameStore((s) => s.playerId);
  const kuhhandel = state?.kuhhandel;
  if (!kuhhandel || !playerId) return null;

  const isInitiator = kuhhandel.initiatorId === playerId;
  const isTarget = kuhhandel.targetId === playerId;

  const initiatorOfferTooltip =
    "Ton offre reste confidentielle jusqu'à la résolution — l'adversaire ne peut pas la voir.";
  const targetOfferTooltip =
    "Le montant exact de l'offre de l'adversaire reste inconnu tant que tu n'as pas accepté ou fait une contre-offre.";

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Kuhhandel — {kuhhandel.species}</h3>

      {isInitiator && kuhhandel.stage === "awaiting_initiator_offer" && (
        <MoneyPicker
          label="Envoyer l'offre secrète"
          onSubmit={(cardIds) =>
            getSocket().emit("kuhhandel:submitOffer", { moneyCardIds: cardIds })
          }
        />
      )}

      {isInitiator && kuhhandel.stage === "awaiting_response" && (
        <div className={styles.tray}>
          <p className={styles.trayLabelInitiator}>Ton offre secrète</p>
          {kuhhandel.initiatorOffer && (
            <div className={styles.trayCards}>
              {kuhhandel.initiatorOffer.map((card) => (
                <div key={card.id} className={styles.trayCard}>
                  <PlayingCard
                    variant="money"
                    label={`Billet ${card.value}`}
                    value={card.value}
                    imageSlot={`bill-${card.value}`}
                    accentColor="var(--kd-accent-green)"
                  />
                </div>
              ))}
            </div>
          )}
          <p className={styles.statusLine}>
            <InfoStatusIcon status="partial" label={initiatorOfferTooltip} />
            <span>Offre envoyée (confidentielle), en attente de la réponse de l'adversaire…</span>
          </p>
        </div>
      )}

      {isTarget && kuhhandel.stage === "awaiting_response" && (
        <div className={styles.responseActions}>
          <div className={styles.tray}>
            <p className={styles.trayLabelTarget}>Offre secrète reçue</p>
            <p className={styles.statusLine}>
              <InfoStatusIcon status="partial" label={targetOfferTooltip} />
              <span>Montant inconnu tant que la résolution n'a pas eu lieu.</span>
            </p>
          </div>
          <div className={styles.acceptRow}>
            <Button variant="primary" onClick={() => getSocket().emit("kuhhandel:accept")}>
              Accepter
            </Button>
          </div>
          <MoneyPicker
            label="Contre-offrir"
            onSubmit={(cardIds) =>
              getSocket().emit("kuhhandel:counter", { moneyCardIds: cardIds })
            }
          />
        </div>
      )}
    </div>
  );
}
