"use client";

import { useEffect, useState } from "react";
import { PlayerAvatarBadge, RarityFrame, type Rarity } from "@kuhhandel/ui";
import { loadProfile, setActiveTitle, type ProfileData } from "../lib/profile";
import { useAuthStore } from "../store/authStore";
import { MatchHistory } from "./MatchHistory";
import styles from "./Profile.module.css";

/** Maps the raw DB rarity string onto `RarityFrame`'s `Rarity` type. Every
 * value matches verbatim except `ultra_secret`, which uses a hyphen in the
 * design system. The explicit return type means a rarity added to the DB
 * without a matching `Rarity` literal fails to compile here. */
function toRarity(dbRarity: string): Rarity {
  return dbRarity === "ultra_secret" ? "ultra-secret" : (dbRarity as Rarity);
}

export function Profile({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const username = useAuthStore((s) => s.profile?.username) ?? "";

  useEffect(() => {
    void loadProfile(userId).then(setProfile);
  }, [userId]);

  if (!profile) return <p className={styles.loading}>Chargement du profil…</p>;

  const activeTitle = profile.titles.find((t) => t.id === profile.currentTitleId);

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <PlayerAvatarBadge name={username} size={100} status="online" />
        <div>
          <div className={styles.username}>{username}</div>
          <div className={styles.titlePill}>{activeTitle ? activeTitle.name : "Aucun titre actif"}</div>
        </div>
      </div>

      <div className={styles.statGrid}>
        <div className={styles.statTile}>
          <div className={styles.statValue}>{profile.level}</div>
          <div className={styles.statLabel}>Niveau</div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statValue}>{profile.xp}</div>
          <div className={styles.statLabel}>XP</div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statValue}>{profile.badges.length}</div>
          <div className={styles.statLabel}>Badges débloqués</div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statValue}>{profile.titles.length}</div>
          <div className={styles.statLabel}>Titres débloqués</div>
        </div>
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Titres</h3>
        {profile.titles.length === 0 ? (
          <p className={styles.emptyState}>Aucun titre débloqué pour l'instant.</p>
        ) : (
          <ul className={styles.titleList}>
            {profile.titles.map((t) => {
              const isActive = profile.currentTitleId === t.id;
              return (
                <li key={t.id} className={styles.titleItem}>
                  <span className={isActive ? styles.titleNameActive : styles.titleName}>
                    {t.name}
                  </span>
                  {isActive ? (
                    <span className={styles.activeLabel}>Actif</span>
                  ) : (
                    <button
                      type="button"
                      className={styles.activateButton}
                      onClick={() =>
                        setActiveTitle(userId, t.id).then(() => loadProfile(userId).then(setProfile))
                      }
                    >
                      Activer
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Badges débloqués ({profile.badges.length})</h3>
        {profile.badges.length === 0 ? (
          <p className={styles.emptyState}>Aucun badge débloqué pour l'instant.</p>
        ) : (
          <div className={styles.badgeGrid}>
            {profile.badges.map((b) => (
              <div key={b.key} className={styles.badgeCell} title={b.description}>
                <RarityFrame rarity={toRarity(b.rarity)} shape="badge" size={56} />
                <span className={styles.badgeName}>{b.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Succès ({profile.achievements.length})</h3>
        {profile.achievements.length === 0 ? (
          <p className={styles.emptyState}>Aucun succès débloqué pour l'instant.</p>
        ) : (
          <ul className={styles.achievementList}>
            {profile.achievements.map((a) => (
              <li key={a.key} className={styles.achievementItem} title={a.description}>
                {a.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Historique récent</h3>
        <MatchHistory userId={userId} />
      </section>
    </div>
  );
}
