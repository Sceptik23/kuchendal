"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useGameStore } from "../store/gameStore";
import { getSocket } from "../lib/socket";
import { playSound } from "../lib/sound";
import {
  familyCounts,
  detectAnimalTransfers,
  detectMoneyTransfers,
  type AnimalTransfer,
  type MoneyTransfer,
} from "../lib/gameEvents";
import { AuctionPanel } from "./AuctionPanel";
import { KuhhandelInitiator, KuhhandelPanel } from "./KuhhandelPanel";
import {
  AnimalStack,
  Button,
  EventFeed,
  InfoStatusIcon,
  PlayerAvatarBadge,
  PlayingCard,
  ToastNarrator,
  TransferGhost,
  type Rect,
} from "@kuhhandel/ui";
import {
  SPECIES_FAMILY_VALUE,
  type DistinctionEntry,
  type GameStateView,
  type RareEventEntry,
  type SpeciesKey,
} from "@kuhhandel/shared-types";
import { SPECIES_COLOR, SPECIES_IMAGE_SLOT, SPECIES_LABEL } from "../lib/species";
import { useEventFeed } from "../hooks/useEventFeed";
import { useFamilyGlow } from "../hooks/useFamilyGlow";
import {
  registerCardPosition,
  registerPlayerSlot,
  getCardRect,
  getPlayerSlotRect,
} from "../lib/cardPositions";
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

/** 08_AI.md §3 — human-readable flavor text for each distinction key. */
const DISTINCTION_LABELS: Record<DistinctionEntry["key"], { title: string; description: string }> = {
  bluff_annee: { title: "Bluff de l'année", description: "Le plus gros bluff réussi en Kuhhandel." },
  ministre_arnaque: { title: "Ministre de l'arnaque", description: "La plus grosse arnaque en Kuhhandel." },
  pigeon_cosmique: { title: "Pigeon cosmique", description: "L'achat le plus surpayé de la partie." },
  banquier_dimanche: { title: "Banquier du dimanche", description: "Le plus gros retournement de situation." },
  meilleur_acteur: { title: "Meilleur acteur", description: "Le bluffeur le plus efficace de la partie." },
};

const RARE_EVENT_BANNER_DURATION_MS = 4000;
const ACTION_ERROR_BANNER_DURATION_MS = 6000;

/**
 * A rejected action (e.g. `error:action` from a stale/reconnected socket,
 * or any other server-side validation failure) previously had nowhere to
 * render during actual gameplay — the store's `error` field was only ever
 * read by Hub/Lobby, so a failed bid, pass, or seller decision here failed
 * completely silently, reading to the player as "the game randomly did
 * something wrong". Auto-dismisses, and is also manually dismissible.
 */
function ActionErrorBanner({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, ACTION_ERROR_BANNER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <button type="button" className={styles.actionErrorBanner} onClick={onDismiss}>
      <span className={styles.actionErrorLabel}>Action refusée</span>
      <span className={styles.actionErrorBody}>{message}</span>
    </button>
  );
}

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
    <div className={styles.hallSection}>
      <div className={styles.finishedSectionLabel}>Hall of Shame &amp; Fame</div>
      <div className={styles.hallGrid}>
        {distinctions.map((entry, i) => {
          const label = DISTINCTION_LABELS[entry.key];
          const player = players.find((p) => p.id === entry.playerId);
          const color = OPPONENT_ACCENTS[i % OPPONENT_ACCENTS.length];
          return (
            <div
              key={entry.key}
              className={styles.hallCard}
              style={{ "--kd-hall-accent": color } as CSSProperties}
            >
              <div className={styles.hallCardTitle}>{label.title}</div>
              <div className={styles.hallCardName}>{player?.name ?? "?"}</div>
              <div className={styles.hallCardDetail}>{label.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 24 confetti pieces cycling through the 5-token accent rotation, matching
 * the design handoff's `confetti-fall` technique (not a glow effect, so it
 * references `--kd-accent-*` directly rather than the glow-token machinery). */
const CONFETTI_PIECES = Array.from({ length: 24 }, (_, i) => ({
  key: i,
  left: `${(i * 4.3) % 100}%`,
  accent: OPPONENT_ACCENTS[i % OPPONENT_ACCENTS.length],
  round: i % 2 === 0,
  duration: `${3 + (i % 4)}s`,
  delay: `${i * 0.15}s`,
}));

function ConfettiField() {
  return (
    <div className={styles.confettiField} aria-hidden="true">
      {CONFETTI_PIECES.map((c) => (
        <span
          key={c.key}
          className={[styles.confettiPiece, c.round ? styles.confettiRound : ""].join(" ")}
          style={
            {
              left: c.left,
              "--kd-confetti-accent": c.accent,
              animationDuration: c.duration,
              animationDelay: c.delay,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Rank 1/2/3 map to the podium colors used across the app; rank 4+ falls
 * back to the subtlest text tone. */
const RANK_COLORS = ["var(--kd-accent-yellow)", "var(--kd-text-muted)", "var(--kd-accent-orange)"];

function rankColor(rank: number): string {
  return RANK_COLORS[rank - 1] ?? "var(--kd-text-subtle)";
}

export function GameTable() {
  const state = useGameStore((s) => s.state);
  const playerId = useGameStore((s) => s.playerId);
  const roomCode = useGameStore((s) => s.roomCode);
  const leave = useGameStore((s) => s.leave);
  const actionError = useGameStore((s) => s.error);
  const clearActionError = useGameStore((s) => s.clearError);
  const eventFeedEntries = useEventFeed(state);
  const familyGlow = useFamilyGlow(state, playerId);

  const prevTransferStateRef = useRef<GameStateView | null>(null);
  const [animalGhosts, setAnimalGhosts] = useState<
    (AnimalTransfer & { id: string; from: Rect; to: Rect })[]
  >([]);
  const [moneyGhosts, setMoneyGhosts] = useState<
    (MoneyTransfer & { id: string; from: Rect; to: Rect })[]
  >([]);
  const ghostSeqRef = useRef(0);

  useEffect(() => {
    if (!state) return;
    const prevState = prevTransferStateRef.current;
    const animalTransfers = detectAnimalTransfers(prevState, state);
    const moneyTransfers = detectMoneyTransfers(prevState, state);
    prevTransferStateRef.current = state;

    for (const t of animalTransfers) {
      const from = getPlayerSlotRect(t.fromPlayerId) ?? getCardRect(t.cardId);
      const to = getPlayerSlotRect(t.toPlayerId);
      if (!from || !to) continue;
      const id = `${ghostSeqRef.current++}`;
      setAnimalGhosts((prev) => [...prev, { ...t, id, from, to }]);
    }
    for (const t of moneyTransfers) {
      const from = getPlayerSlotRect(t.fromPlayerId);
      const to = getPlayerSlotRect(t.toPlayerId);
      if (!from || !to) continue;
      const id = `${ghostSeqRef.current++}`;
      setMoneyGhosts((prev) => [...prev, { ...t, id, from, to }]);
    }
  }, [state]);

  if (!state || !playerId) return null;

  const isMyTurn = state.activePlayerId === playerId;
  const noFlowInProgress = !state.auction && !state.kuhhandel;
  const currentPlayer = state.players.find((p) => p.id === playerId);

  if (state.status === "finished") {
    const ranking = [...state.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const winner = ranking[0];
    return (
      <div className={styles.finishedShell}>
        <ConfettiField />
        <div className={styles.finishedHeader}>
          <div className={styles.finishedEyebrow}>Partie terminée</div>
          {winner && (
            <div className={styles.finishedWinner}>{winner.name} rafle tout !</div>
          )}
        </div>

        <div className={styles.finishedGrid}>
          <div className={styles.rankingCard}>
            <div className={styles.finishedSectionLabel}>Classement final</div>
            <ul className={styles.rankingList}>
              {ranking.map((p, i) => {
                const rank = i + 1;
                const color = rankColor(rank);
                return (
                  <li key={p.id} className={styles.rankingRow}>
                    <span className={styles.rankingNumeral} style={{ color }}>
                      {rank}
                    </span>
                    <PlayerAvatarBadge name={p.name} size={40} />
                    <span className={styles.rankingName}>{p.name}</span>
                    <span className={styles.rankingScore}>{p.score ?? 0} pts</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <HallOfFameShame distinctions={state.distinctions} players={state.players} />
        </div>

        <div className={styles.finishedActions}>
          <Button variant="primary" onClick={leave}>
            Retour au hub
          </Button>
        </div>
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
        <button
          type="button"
          className={styles.resyncButton}
          title="Si la partie semble bloquée, ça re-synchronise ton écran avec l'état réel du serveur."
          onClick={() => {
            if (!roomCode || !playerId) return;
            // Deliberately don't just emit("state:resync") on the existing
            // socket: `socket.connected` can still read `true` on a zombie
            // connection — the underlying transport silently died (proxy
            // drop, idle timeout) but socket.io's own ping heartbeat
            // hasn't noticed yet, which can take up to ~45s by default.
            // Emitting on a zombie socket like that is swallowed with no
            // error, which is why this button could previously look like
            // it did nothing. Forcing a hard reconnect guarantees a fresh
            // transport regardless; gameStore's "connect" handler
            // re-announces the cached session automatically once it
            // succeeds, so no separate emit is needed here.
            const socket = getSocket();
            socket.disconnect();
            socket.connect();
          }}
        >
          ↻ Actualiser
        </button>
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
                <div
                  key={p.id}
                  className={styles.opponentCard}
                  ref={(el) => registerPlayerSlot(p.id, el)}
                >
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
                    {Object.entries(familyCounts(p.animals)).length === 0 && (
                      <span className={styles.opponentAnimalsEmpty}>Aucun animal</span>
                    )}
                    {Object.entries(familyCounts(p.animals)).map(([speciesKey, count]) => {
                      const species = speciesKey as SpeciesKey;
                      return (
                        <AnimalStack
                          key={species}
                          size="sm"
                          label={SPECIES_LABEL[species]}
                          value={SPECIES_FAMILY_VALUE[species]}
                          imageSlot={SPECIES_IMAGE_SLOT[species]}
                          accentColor={SPECIES_COLOR[species]}
                          count={count}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>

        <div className={styles.tableRow}>
          <div className={styles.centerStage}>
            {state.auction && (
              <div className={styles.auctionStage}>
                <div className={styles.auctionCard}>
                  <PlayingCard
                    key={state.auction.card.id}
                    variant="animal"
                    label={SPECIES_LABEL[state.auction.card.species]}
                    value={SPECIES_FAMILY_VALUE[state.auction.card.species]}
                    imageSlot={SPECIES_IMAGE_SLOT[state.auction.card.species]}
                    accentColor={SPECIES_COLOR[state.auction.card.species]}
                    revealing
                  />
                </div>
                <AuctionPanel />
              </div>
            )}
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
          <div className={styles.eventFeedSlot}>
            <EventFeed entries={eventFeedEntries} />
          </div>
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
          <div className={styles.selfIdentity} ref={(el) => registerPlayerSlot(playerId, el)}>
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
            {Object.entries(familyCounts(currentPlayer.animals)).map(([speciesKey, count]) => {
              const species = speciesKey as SpeciesKey;
              const ids = currentPlayer.animals
                .filter((a) => a.species === species)
                .map((a) => a.id);
              return (
                <div key={species} className={styles.selfHandCard}>
                  <AnimalStack
                    rootRef={(el) => {
                      for (const id of ids) registerCardPosition(id, el);
                    }}
                    label={SPECIES_LABEL[species]}
                    value={SPECIES_FAMILY_VALUE[species]}
                    imageSlot={SPECIES_IMAGE_SLOT[species]}
                    accentColor={SPECIES_COLOR[species]}
                    count={count}
                    completed={familyGlow.isCompleted(species)}
                    justCompleted={familyGlow.isJustCompleted(species)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <RareEventBanner state={state} />
      <ActionErrorBanner message={actionError} onDismiss={clearActionError} />

      {animalGhosts.map((g) => (
        <TransferGhost
          key={g.id}
          from={g.from}
          to={g.to}
          onDone={() => setAnimalGhosts((prev) => prev.filter((x) => x.id !== g.id))}
        >
          <PlayingCard
            variant="animal"
            label={SPECIES_LABEL[g.species as keyof typeof SPECIES_LABEL]}
            value={SPECIES_FAMILY_VALUE[g.species as keyof typeof SPECIES_FAMILY_VALUE]}
            imageSlot={SPECIES_IMAGE_SLOT[g.species as keyof typeof SPECIES_IMAGE_SLOT]}
            accentColor={SPECIES_COLOR[g.species as keyof typeof SPECIES_COLOR]}
          />
        </TransferGhost>
      ))}
      {moneyGhosts.map((g) => (
        <TransferGhost
          key={g.id}
          from={g.from}
          to={g.to}
          onDone={() => setMoneyGhosts((prev) => prev.filter((x) => x.id !== g.id))}
        >
          {/* Generic bill-back visual: the viewer isn't necessarily a party
              to this transfer and must never be shown a value they have no
              way of actually knowing (existing hidden-info invariant). */}
          <PlayingCard
            variant="money"
            label={`${g.cardCount} carte(s)`}
            value={0}
            imageSlot="bill-0"
            accentColor="var(--kd-accent-yellow)"
          />
        </TransferGhost>
      ))}
    </div>
  );
}
