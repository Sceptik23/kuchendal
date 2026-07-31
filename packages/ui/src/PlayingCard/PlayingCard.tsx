'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import styles from './PlayingCard.module.css';

export type PlayingCardVariant = 'animal' | 'money';

export interface PlayingCardProps {
  variant: PlayingCardVariant;
  label: string;
  value: number;
  imageSlot: string;
  accentColor: string;
  /** One-shot: true only for the render cycle where this card first appears
   * face-up (spec §2 "Card flip") — not a persistent state the caller keeps
   * toggled on. */
  revealing?: boolean;
}

export function PlayingCard({
  variant,
  label,
  value,
  imageSlot,
  accentColor,
  revealing = false,
}: PlayingCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const style = { '--pc-accent': accentColor } as CSSProperties;

  const cardClassName = [styles.card, styles[variant], revealing ? styles.revealing : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.wrapper}>
      <div className={revealing ? styles.flipContainer : undefined}>
        <div className={cardClassName} style={style}>
          <div className={styles.art}>
            {imageFailed ? (
              <div className={styles.placeholder}>{label}</div>
            ) : (
              <img
                src={`/cards/${imageSlot}.webp`}
                alt={label}
                className={styles.image}
                onError={() => setImageFailed(true)}
              />
            )}
          </div>
          <div className={styles.value}>{value}</div>
        </div>
      </div>
      <div className={styles.caption}>{label}</div>
    </div>
  );
}
