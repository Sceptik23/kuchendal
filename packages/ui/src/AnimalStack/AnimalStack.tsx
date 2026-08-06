'use client';

import type { CSSProperties, Ref } from 'react';
import { PlayingCard } from '../PlayingCard/PlayingCard';
import styles from './AnimalStack.module.css';

export interface AnimalStackProps {
  label: string;
  value: number;
  imageSlot: string;
  accentColor: string;
  /** Number of cards of this species this player holds — always exact
   * (the count is public info in Kuhhandel, unlike money). */
  count: number;
  size?: 'sm' | 'md';
  completed?: boolean;
  justCompleted?: boolean;
  /** Attached to the stack's outer node so callers can resolve a transfer
   * animation's landing rect to wherever the whole pile renders. */
  rootRef?: Ref<HTMLDivElement>;
}

/** A species' cards rendered as one physical-style pile: the top card in
 * full, a capped number of offset backing slices behind it (never more than
 * 3 — no species has more than 4 copies in the deck, so a pile never needs
 * a "+N" overflow), and a count badge. */
export function AnimalStack({
  label,
  value,
  imageSlot,
  accentColor,
  count,
  size = 'md',
  completed = false,
  justCompleted = false,
  rootRef,
}: AnimalStackProps) {
  const backingSlices = Math.min(Math.max(count - 1, 0), 3);
  const style = { '--as-accent': accentColor } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={[styles.stack, styles[size]].join(' ')}
      style={style}
    >
      {Array.from({ length: backingSlices }, (_, i) => (
        <div
          key={i}
          className={styles.slice}
          style={{ '--as-depth': backingSlices - i } as CSSProperties}
        />
      ))}
      <div className={styles.top}>
        <PlayingCard
          variant="animal"
          label={label}
          value={value}
          imageSlot={imageSlot}
          accentColor={accentColor}
          completed={completed}
          justCompleted={justCompleted}
        />
      </div>
      {count > 1 && <div className={styles.badge}>×{count}</div>}
    </div>
  );
}
