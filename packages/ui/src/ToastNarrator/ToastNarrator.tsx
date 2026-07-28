import type { CSSProperties } from 'react';
import type { NarratorStyle } from '@kuhhandel/shared-types';
import styles from './ToastNarrator.module.css';

const NARRATOR_LABEL: Record<NarratorStyle, string> = {
  sport: 'Commentateur sportif',
  documentary: 'Documentaire animalier',
  western: 'Western',
  tv: 'Présentateur télé',
};

const NARRATOR_COLOR_VAR: Record<NarratorStyle, string> = {
  sport: 'var(--kd-accent-green)',
  documentary: 'var(--kd-accent-cyan)',
  western: 'var(--kd-accent-orange)',
  tv: 'var(--kd-accent-pink)',
};

export interface ToastNarratorProps {
  narratorStyle: NarratorStyle;
  message: string;
}

export function ToastNarrator({ narratorStyle, message }: ToastNarratorProps) {
  const style = { '--tn-color': NARRATOR_COLOR_VAR[narratorStyle] } as CSSProperties;
  return (
    <div className={styles.toast} style={style}>
      <div className={styles.label}>{NARRATOR_LABEL[narratorStyle]}</div>
      <div className={styles.message}>{message}</div>
      <div className={styles.tail} />
    </div>
  );
}
