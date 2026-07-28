"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { getSocket } from "../lib/socket";
import { playSound } from "../lib/sound";
import { AuctionPanel } from "./AuctionPanel";
import { KuhhandelInitiator, KuhhandelPanel } from "./KuhhandelPanel";
import type { DistinctionEntry, GameStateView, RareEventEntry } from "@kuhhandel/shared-types";

function familyCounts(animals: { species: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of animals) counts[a.species] = (counts[a.species] ?? 0) + 1;
  return counts;
}

/** 08_AI.md §3 — human-readable flavor text for each distinction key. */
const DISTINCTION_LABELS: Record<DistinctionEntry["key"], { title: string; description: string }> = {
  bluff_annee: { title: "Bluff de l'année", description: "Le plus gros bluff réussi en Kuhhandel." },
  ministre_arnaque: { title: "Ministre de l'arnaque", description: "La plus grosse arnaque en Kuhhandel." },
  pigeon_cosmique: { title: "Pigeon cosmique", description: "L'achat le plus surpayé de la partie." },
  banquier_dimanche: { title: "Banquier du dimanche", description: "Le plus gros retournement de situation." },
  meilleur_acteur: { title: "Meilleur acteur", description: "Le bluffeur le plus efficace de la partie." },
};

const RARE_EVENT_BANNER_DURATION_MS = 4000;

/**
 * Shows the most recent rare event as a brief banner (06_AUDIO_VFX.md §3:
 * "effet spotlight bref") and best-effort plays its sound — purely
 * cosmetic, never blocks or represents any game-affecting state.
 */
function RareEventBanner({ state }: { state: GameStateView }) {
  const [current, setCurrent] = useState<RareEventEntry | null>(null);
  const seenCount = useRef(0);

  useEffect(() => {
    const feed = state.rareEventsFeed;
    if (feed.length <= seenCount.current) {
      seenCount.current = feed.length;
      return;
    }
    const latest = feed[feed.length - 1]!;
    seenCount.current = feed.length;
    setCurrent(latest);
    playSound(latest.sound);
    const timer = setTimeout(() => setCurrent(null), RARE_EVENT_BANNER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [state.rareEventsFeed]);

  if (!current) return null;
  return (
    <div data-vfx={current.vfx} style={{ animation: "pulse 1.2s ease-in-out" }}>
      ✨ {current.name} — {current.flavorText}
    </div>
  );
}

function NarratorFeed({ state }: { state: GameStateView }) {
  if (state.narratorFeed.length === 0) return null;
  return (
    <aside>
      <h4>Narrateur</h4>
      <ul>
        {state.narratorFeed.map((message, i) => (
          <li key={i}>{message.text}</li>
        ))}
      </ul>
    </aside>
  );
}

function HallOfFameShame({
  distinctions,
  players,
}: {
  distinctions: DistinctionEntry[];
  players: { id: string; name: string }[];
}) {
  if (distinctions.length === 0) return null;
  return (
    <div>
      <h3>Hall of Shame / Hall of Fame</h3>
      <ul>
        {distinctions.map((entry) => {
          const label = DISTINCTION_LABELS[entry.key];
          const player = players.find((p) => p.id === entry.playerId);
          return (
            <li key={entry.key}>
              <strong>{label.title}</strong> — {player?.name ?? "?"} ({label.description})
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function GameTable() {
  const state = useGameStore((s) => s.state);
  const playerId = useGameStore((s) => s.playerId);
  if (!state || !playerId) return null;

  const isMyTurn = state.activePlayerId === playerId;
  const noFlowInProgress = !state.auction && !state.kuhhandel;

  if (state.status === "finished") {
    return (
      <div>
        <h2>Partie terminée</h2>
        <ul>
          {[...state.players]
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .map((p) => (
              <li key={p.id}>
                {p.name} — {p.score} points
              </li>
            ))}
        </ul>
        <HallOfFameShame distinctions={state.distinctions} players={state.players} />
      </div>
    );
  }

  return (
    <div>
      <h2>Table de jeu</h2>
      <p>Pioche restante : {state.deckCount}</p>
      <p>
        Tour de :{" "}
        {state.players.find((p) => p.id === state.activePlayerId)?.name ?? "?"}
        {isMyTurn && " (toi)"}
      </p>

      {/*
        05_UI_UX.md §4: always distinguish "connu avec certitude" (ma main
        exacte) de "partiellement connu" (nombre de cartes d'un adversaire,
        montant caché) — jamais laisser deviner une certitude qu'on n'a pas.
      */}
      <ul>
        {state.players.map((p) => {
          const isMe = p.id === playerId;
          return (
            <li key={p.id}>
              {p.name}
              {" — "}
              {isMe ? (
                <span title="Montant exact connu (ta main)">
                  ✅ {p.money?.reduce((sum, c) => sum + c.value, 0) ?? 0} en argent (
                  {p.money?.map((c) => c.value).join(", ") ?? ""})
                </span>
              ) : (
                <span title="Montant caché — seul le nombre de cartes est visible">
                  🔒 {p.moneyCount} carte{p.moneyCount === 1 ? "" : "s"} argent (montant inconnu)
                </span>
              )}
              {" — animaux (publics) : "}
              {Object.entries(familyCounts(p.animals))
                .map(([species, count]) => `${species} x${count}`)
                .join(", ") || "aucun"}
            </li>
          );
        })}
      </ul>

      {isMyTurn && noFlowInProgress && (
        <div>
          <button onClick={() => getSocket().emit("turn:startAuction")}>
            Révéler une carte (enchère)
          </button>
          <KuhhandelInitiator />
        </div>
      )}

      <AuctionPanel />
      <KuhhandelPanel />
      <NarratorFeed state={state} />
      <RareEventBanner state={state} />
    </div>
  );
}
