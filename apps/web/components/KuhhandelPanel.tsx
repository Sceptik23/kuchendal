"use client";

import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { getSocket } from "../lib/socket";

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
    <div>
      <ul>
        {money.map((card) => (
          <li key={card.id}>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(card.id)}
                onChange={() => toggle(card.id)}
              />
              {card.value}
            </label>
          </li>
        ))}
      </ul>
      <button onClick={() => onSubmit(selected)}>{label}</button>
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
    <div>
      <h3>Lancer un Kuhhandel</h3>
      <select value={currentTarget.player.id} onChange={(e) => setTargetId(e.target.value)}>
        {eligibleTargets.map((t) => (
          <option key={t.player.id} value={t.player.id}>
            {t.player.name}
          </option>
        ))}
      </select>
      <select
        value={species || currentTarget.sharedSpecies[0]}
        onChange={(e) => setSpecies(e.target.value)}
      >
        {[...new Set(currentTarget.sharedSpecies)].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        onClick={() =>
          getSocket().emit("turn:startKuhhandel", {
            targetId: currentTarget.player.id,
            species: species || currentTarget.sharedSpecies[0]!,
          })
        }
      >
        Initier
      </button>
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

  return (
    <div>
      <h3>Kuhhandel — {kuhhandel.species}</h3>

      {isInitiator && kuhhandel.stage === "awaiting_initiator_offer" && (
        <MoneyPicker
          label="Envoyer l'offre secrète"
          onSubmit={(cardIds) =>
            getSocket().emit("kuhhandel:submitOffer", { moneyCardIds: cardIds })
          }
        />
      )}

      {isInitiator && kuhhandel.stage === "awaiting_response" && (
        <p>Offre envoyée, en attente de la réponse de l'adversaire…</p>
      )}

      {isTarget && kuhhandel.stage === "awaiting_response" && (
        <div>
          <button onClick={() => getSocket().emit("kuhhandel:accept")}>Accepter</button>
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
