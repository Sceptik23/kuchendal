"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useGameStore } from "../store/gameStore";
import { getSocket } from "../lib/socket";
import { playSound } from "../lib/sound";
import { AuctionPanel } from "./AuctionPanel";
import { KuhhandelInitiator, KuhhandelPanel } from "./KuhhandelPanel";
import { Button, InfoStatusIcon, PlayerAvatarBadge, PlayingCard, ToastNarrator } from "@kuhhandel/ui";
import {
  SPECIES_FAMILY_VALUE,
  type DistinctionEntry,
  type GameStateView,
  type RareEventEntry,
  type SpeciesKey,
} from "@kuhhandel/shared-types";
import styles from "./GameTable.module.css";

/**
 * 5-token accent rotation used to give each opponent a stable identity
 * color, matching the design handoff's opponents-row treatment (and the
 * same accent set used for the Lobby's ready-glow).
 */
const OPPONENT_ACCENTS = [
  "var(--kd-accent-green)",
  "var(--kd-accent-pink)",
  "var(--kd-accent-cyan)",
  "var(--kd-accent-yellow)",
  "var(--kd-accent-orange)",
];

/**
 * Species keys are lowercase ASCII (`cochon`, `chevre`, `ane`, ...) but the
 * extracted card artwork filenames use capitalized, accented French names
 * (`Cochon`, `Chèvre`, `Âne`, ...) — see `apps/web/app/style-guide/page.tsx`
 * for the source pattern. `boeuf` has no artwork (Phase 1 style guide),
 * so it maps to a slot that intentionally doesn't resolve to a real file,
 * letting `PlayingCard`'s placeholder fallback render instead.
 */
const SPECIES_IMAGE_SLOT: Record<SpeciesKey, string> = {
  cochon: "animal-Cochon",
  oie: "animal-Oie",
  mouton: "animal-Mouton",
  chevre: "animal-Chèvre",
  ane: "animal-Âne",
  chien: "animal-Chien",
  chat: "animal-Chat",
  cheval: "animal-Cheval",
  boeuf: "animal-missing",
  vache: "animal-Vache",
};

const SPECIES_LABEL: Record<SpeciesKey, string> = {
  cochon: "Cochon",
  oie: "Oie",
  mouton: "Mouton",
  chevre: "Chèvre",
  ane: "Âne",
  chien: "Chien",
  chat: "Chat",
  cheval: "Cheval",
  boeuf: "Bœuf",
  vache: "Vache",
};

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
    <div data-vfx={current.vfx} className={styles.rareEventBanner}>
      <div className={styles.rareEventSweep} />
      <div className={styles.rareEventLabel}>Événement rare</div>
      <div className={styles.rareEventBody}>
        ✨ {current.name} — {current.flavorText}
      </div>
    </div>
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
  const currentPlayer = state.players.find((p) => p.id === playerId);

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

  const latestNarratorMessage = state.narratorFeed[state.narratorFeed.length - 1];

  return (
    <div className={styles.shell}>
      <div className={styles.topBar}>
        <div className={styles.logo}>KUCHENDAL</div>
        <div className={styles.deckCount}>Pioche restante : {state.deckCount}</div>
        <div className={styles.turnIndicator}>
          Tour de :{" "}
          {state.players.find((p) => p.id === state.activePlayerId)?.name ?? "?"}
          {isMyTurn && " (toi)"}
        </div>
      </div>

      <div className={styles.table}>
        {/*
          05_UI_UX.md §4: always distinguish "connu avec certitude" (ma main
          exacte) de "partiellement connu" (nombre de cartes d'un adversaire,
          montant caché) — jamais laisser deviner une certitude qu'on n'a pas.
          Opponents' exact money is never sent to this client (see
          PlayerView.money: MoneyCard[] | null), so only the moneyCount view
          is shown here.
        */}
        <div className={styles.opponentsRow}>
          {state.players
            .filter((p) => p.id !== playerId)
            .map((p, i) => {
              const isActive = p.id === state.activePlayerId;
              const accent = OPPONENT_ACCENTS[i % OPPONENT_ACCENTS.length];
              return (
                <div key={p.id} className={styles.opponentCard}>
                  <div
                    className={[styles.avatarRing, isActive ? styles.avatarRingActive : ""]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ "--kd-opp-accent": accent } as CSSProperties}
                  >
                    <PlayerAvatarBadge name={p.name} size={64} />
                  </div>
                  <div className={styles.opponentName}>{p.name}</div>
                  <div className={styles.opponentMoney}>
                    <InfoStatusIcon
                      status="partial"
                      label="Montant caché — seul le nombre de cartes est visible"
                    />
                    <span>{p.moneyCount} carte(s) argent</span>
                  </div>
                  <div className={styles.opponentAnimals}>
                    {Object.entries(familyCounts(p.animals))
                      .map(([species, count]) => `${species} x${count}`)
                      .join(", ") || "aucun animal"}
                  </div>
                </div>
              );
            })}
        </div>

        <div className={styles.centerStage}>
          {state.auction && (
            <div className={styles.auctionStage}>
              <div className={styles.auctionCard}>
                <PlayingCard
                  variant="animal"
                  label={SPECIES_LABEL[state.auction.card.species]}
                  value={SPECIES_FAMILY_VALUE[state.auction.card.species]}
                  imageSlot={SPECIES_IMAGE_SLOT[state.auction.card.species]}
                  accentColor="var(--kd-accent-cyan)"
                />
              </div>
              <AuctionPanel />
            </div>
          )}
          {!state.auction && <AuctionPanel />}
          <KuhhandelPanel />
          {latestNarratorMessage && (
            <div className={styles.narratorSlot}>
              {/*
                GameStateView doesn't yet expose which narrator style the
                room uses, so this is hardcoded to "sport" as a placeholder
                until that field exists on the backend.
              */}
              <ToastNarrator narratorStyle="sport" message={latestNarratorMessage.text} />
            </div>
          )}
        </div>

        {isMyTurn && noFlowInProgress && (
          <div className={styles.turnActions}>
            <Button variant="primary" onClick={() => getSocket().emit("turn:startAuction")}>
              Révéler une carte (enchère)
            </Button>
            <KuhhandelInitiator />
          </div>
        )}
      </div>

      {currentPlayer && (
        <div className={styles.selfRail}>
          <div className={styles.selfIdentity}>
            <PlayerAvatarBadge name={currentPlayer.name} size={56} />
            <div className={styles.selfName}>{currentPlayer.name} (toi)</div>
            <div className={styles.selfMoney}>
              <InfoStatusIcon status="known" label="Montant exact connu (ta main)" />
              <span>
                {currentPlayer.money?.reduce((sum, c) => sum + c.value, 0) ?? 0} en argent
              </span>
            </div>
          </div>
          <div className={styles.selfHand}>
            {currentPlayer.animals.length === 0 && (
              <span className={styles.selfHandEmpty}>Aucun animal</span>
            )}
            {currentPlayer.animals.map((a, i) => (
              <div key={a.id} className={styles.selfHandCard}>
                <PlayingCard
                  variant="animal"
                  label={SPECIES_LABEL[a.species]}
                  value={SPECIES_FAMILY_VALUE[a.species]}
                  imageSlot={SPECIES_IMAGE_SLOT[a.species]}
                  accentColor={OPPONENT_ACCENTS[i % OPPONENT_ACCENTS.length] as string}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <RareEventBanner state={state} />
    </div>
  );
}
