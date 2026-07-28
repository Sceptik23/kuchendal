"use client";

import { useState } from "react";
import { Button, PlayerAvatarBadge } from "@kuhhandel/ui";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { getSocket } from "../lib/socket";
import { InviteQrCode } from "./InviteQrCode";
import styles from "./Lobby.module.css";

const SLOT_COUNT = 6;

export function Lobby() {
  const state = useGameStore((s) => s.state);
  const roomCode = useGameStore((s) => s.roomCode);
  const error = useGameStore((s) => s.error);
  const playerId = useGameStore((s) => s.playerId);
  const profile = useAuthStore((s) => s.profile);
  const [copyLabel, setCopyLabel] = useState("Copier");

  if (!state || !profile) return null;

  const canStart = state.players.length >= 3;
  const isHost = state.hostPlayerId === playerId;
  const inviteUrl =
    typeof window !== "undefined" && roomCode
      ? `${window.location.origin}?join=${roomCode}`
      : "";

  const handleCopy = () => {
    void navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopyLabel("Copié !");
      setTimeout(() => setCopyLabel("Copier"), 1500);
    });
  };

  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => state.players[i] ?? null);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Lobby</h2>
        {roomCode && (
          <div className={styles.codeChip}>
            <span className={styles.codeLabel}>Code</span>
            <span className={styles.codeValue}>{roomCode}</span>
            <Button variant="primary" onClick={handleCopy} disabled={!inviteUrl}>
              {copyLabel}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <div className={styles.grid}>
        <div>
          <div className={styles.sectionLabel}>
            Joueurs ({state.players.length}/{SLOT_COUNT})
          </div>
          <div className={styles.playerGrid}>
            {slots.map((p, i) =>
              p ? (
                <div
                  key={p.id}
                  className={[styles.slot, styles.slotFilled].join(" ")}
                >
                  <PlayerAvatarBadge name={p.name} size={56} />
                  <div className={styles.slotName}>
                    {p.name}
                    {p.id === state.hostPlayerId && <span className={styles.hostStar}>★</span>}
                  </div>
                  <div className={styles.readyLabel}>Prêt</div>
                  {isHost && p.id !== playerId && (
                    <div className={styles.slotActions}>
                      <Button
                        variant="secondary"
                        onClick={() => getSocket().emit("host:kick", { playerId: p.id })}
                      >
                        Expulser
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => getSocket().emit("host:transfer", { playerId: p.id })}
                      >
                        Transférer l&apos;hôte
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div key={`empty-${i}`} className={[styles.slot, styles.slotEmpty].join(" ")}>
                  <div className={styles.emptyAvatar} />
                  <div className={styles.slotEmptyLabel}>en attente…</div>
                </div>
              ),
            )}
          </div>
        </div>

        <div className={styles.settingsCard}>
          <div className={styles.sectionLabel}>Réglages de la partie</div>

          {isHost && (
            <div className={styles.botRow}>
              <Button
                variant="secondary"
                onClick={() => getSocket().emit("host:addBot", { difficulty: "easy" })}
              >
                Ajouter un bot (facile)
              </Button>
              <Button
                variant="secondary"
                onClick={() => getSocket().emit("host:addBot", { difficulty: "normal" })}
              >
                Ajouter un bot (normal)
              </Button>
            </div>
          )}

          <Button
            variant="primary"
            disabled={!canStart}
            onClick={() => getSocket().emit("lobby:start")}
          >
            Démarrer la partie {!canStart && "(3 joueurs minimum)"}
          </Button>

          {roomCode && (
            <div className={styles.inviteBlock}>
              <p className={styles.inviteText}>
                Invite tes amis avec ce lien :{" "}
                <span className={styles.inviteUrl}>{inviteUrl}</span>
              </p>
              <div className={styles.qrWrapper}>
                <InviteQrCode url={inviteUrl} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
