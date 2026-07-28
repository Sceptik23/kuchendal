import styles from './InfoStatusIcon.module.css';

export type InfoStatus = 'known' | 'partial';

export interface InfoStatusIconProps {
  status: InfoStatus;
  label: string;
}

export function InfoStatusIcon({ status, label }: InfoStatusIconProps) {
  return (
    <span
      className={[styles.icon, styles[status]].join(' ')}
      role="img"
      aria-label={label}
      title={label}
    />
  );
}
