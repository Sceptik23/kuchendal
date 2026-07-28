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
}

export function PlayingCard({ variant, label, value, imageSlot, accentColor }: PlayingCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const style = { '--pc-accent': accentColor } as CSSProperties;

  return (
    <div className={styles.wrapper}>
      <div className={[styles.card, styles[variant]].join(' ')} style={style}>
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
      <div className={styles.caption}>{label}</div>
    </div>
  );
}
