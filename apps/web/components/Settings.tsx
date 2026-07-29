"use client";

import { useEffect, useState } from "react";
import { Button, Input, PlayerAvatarBadge } from "@kuhhandel/ui";
import { useAuthStore } from "../store/authStore";
import {
  getDefaultNarratorStyle,
  getSoundEnabled,
  setDefaultNarratorStyle,
  setSoundEnabled,
} from "../lib/preferences";
import type { NarratorStyle } from "@kuhhandel/shared-types";
import styles from "./Settings.module.css";

const NARRATOR_STYLE_LABELS: Record<NarratorStyle, string> = {
  sport: "Commentateur sportif",
  documentary: "Documentaire animalier",
  western: "Western",
  tv: "Présentateur télé",
};

const NARRATOR_STYLES = Object.keys(NARRATOR_STYLE_LABELS) as NarratorStyle[];

function Switch({
  on,
  onToggle,
  disabled,
  title,
}: {
  on: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={[styles.switch, on ? styles.switchOn : ""].filter(Boolean).join(" ")}
      onClick={onToggle}
      disabled={disabled}
      title={title}
      role="switch"
      aria-checked={on}
    >
      <div className={styles.switchKnob} />
    </button>
  );
}

export function Settings() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  const [narratorStyle, setNarratorStyle] = useState<NarratorStyle>("sport");
  const [soundEnabled, setSoundEnabledState] = useState(true);

  useEffect(() => {
    setNarratorStyle(getDefaultNarratorStyle());
    setSoundEnabledState(getSoundEnabled());
  }, []);

  if (!profile) return null;

  function selectNarratorStyle(style: NarratorStyle) {
    setDefaultNarratorStyle(style);
    setNarratorStyle(style);
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSoundEnabledState(next);
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Paramètres du compte</h1>

      <section className={styles.card}>
        <div className={styles.avatarRow}>
          <PlayerAvatarBadge name={profile.username} size={64} />
          <div>
            <div className={styles.username}>{profile.username}</div>
            <Button
              variant="secondary"
              className={styles.linkButton}
              disabled
              title="Bientôt disponible — pas encore de système d'avatars"
            >
              Changer l'avatar
            </Button>
          </div>
        </div>
        <label className={styles.fieldLabel} htmlFor="settings-pseudo">
          Pseudo
        </label>
        <Input id="settings-pseudo" value={profile.username} readOnly />
        <p className={styles.caption}>Modifiable prochainement.</p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Préférences de jeu</h2>

        <div className={styles.subLabel}>Style de narrateur par défaut</div>
        <div className={styles.narratorList}>
          {NARRATOR_STYLES.map((id) => (
            <button
              key={id}
              type="button"
              className={[
                styles.narratorOption,
                narratorStyle === id ? styles.narratorOptionSelected : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => selectNarratorStyle(id)}
            >
              {NARRATOR_STYLE_LABELS[id]}
            </button>
          ))}
        </div>

        <div className={styles.toggleRow}>
          <div className={styles.toggleLabel}>Effets sonores</div>
          <Switch on={soundEnabled} onToggle={toggleSound} />
        </div>

        <div className={styles.toggleRow}>
          <div>
            <div className={styles.toggleLabel}>Musique</div>
            <div className={styles.caption}>Bientôt disponible</div>
          </div>
          <Switch on={false} disabled title="Bientôt disponible — pas encore de système de musique" />
        </div>

        <div className={styles.toggleRow}>
          <div>
            <div className={styles.toggleLabel}>Notifications</div>
            <div className={styles.caption}>Bientôt disponible</div>
          </div>
          <Switch
            on={false}
            disabled
            title="Bientôt disponible — pas encore de système de notifications"
          />
        </div>
      </section>

      <section className={[styles.card, styles.dangerCard].join(" ")}>
        <h2 className={[styles.sectionTitle, styles.dangerTitle].join(" ")}>Zone sensible</h2>
        <div className={styles.dangerRow}>
          <Button variant="secondary" onClick={() => void signOut()}>
            Se déconnecter
          </Button>
          <Button
            variant="danger"
            disabled
            title="Bientôt disponible — contacte le support pour une suppression manuelle"
          >
            Supprimer le compte
          </Button>
        </div>
      </section>
    </div>
  );
}
