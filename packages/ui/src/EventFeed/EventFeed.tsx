import styles from './EventFeed.module.css';

export interface EventFeedEntry {
  id: string;
  text: string;
}

export interface EventFeedProps {
  /** Newest first — the caller owns ordering and the 50-entry cap (spec §1). */
  entries: EventFeedEntry[];
}

export function EventFeed({ entries }: EventFeedProps) {
  return (
    <div className={styles.feed}>
      <div className={styles.header}>Journal de partie</div>
      {entries.length === 0 ? (
        <div className={styles.empty}>Aucun événement pour l'instant.</div>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.item}>
              {entry.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
