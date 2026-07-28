import type { CSSProperties, ReactNode } from 'react';
import styles from './RarityFrame.module.css';

export const RARITIES = [
  'commun',
  'rare',
  'epique',
  'legendaire',
  'mythique',
  'secret',
  'ultra-secret',
] as const;
export type Rarity = (typeof RARITIES)[number];

const RARITY_COLOR_VAR: Record<Exclude<Rarity, 'ultra-secret'>, string> = {
  commun: 'var(--kd-rarity-commun)',
  rare: 'var(--kd-rarity-rare)',
  epique: 'var(--kd-rarity-epique)',
  legendaire: 'var(--kd-rarity-legendaire)',
  mythique: 'var(--kd-rarity-mythique)',
  secret: 'var(--kd-rarity-secret)',
};

const GLOW_RARITIES = new Set<Rarity>(['legendaire', 'mythique', 'secret', 'ultra-secret']);

export interface RarityFrameProps {
  rarity: Rarity;
  size?: number;
  shape?: 'badge' | 'circle';
  children?: ReactNode;
}

export function RarityFrame({ rarity, size = 52, shape = 'badge', children }: RarityFrameProps) {
  const isHolo = rarity === 'ultra-secret';
  const glow = GLOW_RARITIES.has(rarity);

  const style: CSSProperties & Record<string, string | number> = { width: size, height: size };
  if (!isHolo) {
    style['--rf-color'] = RARITY_COLOR_VAR[rarity];
  }

  const classes = [
    styles.frame,
    isHolo ? styles.holo : styles.solid,
    glow ? styles.glow : '',
    shape === 'circle' ? styles.circle : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}
