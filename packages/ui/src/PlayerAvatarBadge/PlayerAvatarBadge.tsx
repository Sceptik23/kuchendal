import { RarityFrame, type Rarity } from '../RarityFrame/RarityFrame';
import styles from './PlayerAvatarBadge.module.css';

export interface PlayerAvatarBadgeProps {
  name: string;
  imageSrc?: string;
  status?: 'online' | 'offline';
  rarity?: Rarity;
  size?: number;
}

export function PlayerAvatarBadge({
  name,
  imageSrc,
  status = 'offline',
  rarity = 'commun',
  size = 72,
}: PlayerAvatarBadgeProps) {
  return (
    <div className={styles.wrapper} style={{ width: size, height: size }}>
      <RarityFrame rarity={rarity} size={size} shape="circle">
        {imageSrc ? (
          <img src={imageSrc} alt={name} className={styles.image} />
        ) : (
          <span className={styles.initial}>{name.charAt(0).toUpperCase()}</span>
        )}
      </RarityFrame>
      <span
        className={[styles.status, status === 'online' ? styles.online : styles.offline].join(' ')}
      />
    </div>
  );
}
