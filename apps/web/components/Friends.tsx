"use client";

import { useEffect, useState } from "react";
import { Button, Input, PlayerAvatarBadge } from "@kuhhandel/ui";
import {
  listFriendships,
  removeFriendship,
  respondToFriendRequest,
  searchUsersByUsername,
  sendFriendRequest,
  type FriendListEntry,
  type UserSearchResult,
} from "../lib/friends";
import { usePresenceStore } from "../store/presenceStore";
import styles from "./Friends.module.css";

export function Friends({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<FriendListEntry[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const onlineUserIds = usePresenceStore((s) => s.onlineUserIds);

  async function refresh() {
    setEntries(await listFriendships(userId));
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function search(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setResults(await searchUsersByUsername(q.trim(), userId));
  }

  const accepted = entries.filter((e) => e.status === "accepted");
  const incoming = entries.filter((e) => e.status === "pending" && !e.requestedByMe);
  const outgoing = entries.filter((e) => e.status === "pending" && e.requestedByMe);

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Amis en ligne</h3>

      <Input
        placeholder="Rechercher un pseudo…"
        value={query}
        onChange={(e) => void search(e.target.value)}
        className={styles.searchInput}
      />

      <ul className={styles.list}>
        {results.map((u) => (
          <li key={u.id} className={styles.listItem}>
            <div className={styles.friendInfo}>
              <span className={styles.friendName}>{u.username}</span>
            </div>
            <div className={styles.actions}>
              <Button
                variant="secondary"
                onClick={() =>
                  sendFriendRequest(userId, u.id).then(() => {
                    setResults((r) => r.filter((x) => x.id !== u.id));
                    void refresh();
                  })
                }
              >
                Ajouter
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {incoming.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Demandes reçues</h4>
          <ul className={styles.list}>
            {incoming.map((e) => (
              <li key={e.friendshipId} className={styles.listItem}>
                <div className={styles.friendInfo}>
                  <PlayerAvatarBadge
                    name={e.friend.username}
                    size={44}
                    status={onlineUserIds.has(e.friend.id) ? "online" : "offline"}
                  />
                  <span className={styles.friendName}>{e.friend.username}</span>
                </div>
                <div className={styles.actions}>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      respondToFriendRequest(e.friendshipId, "accepted").then(refresh)
                    }
                  >
                    Accepter
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => removeFriendship(e.friendshipId).then(refresh)}
                  >
                    Refuser
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Demandes envoyées</h4>
          <ul className={styles.list}>
            {outgoing.map((e) => (
              <li key={e.friendshipId} className={styles.listItem}>
                <div className={styles.friendInfo}>
                  <PlayerAvatarBadge
                    name={e.friend.username}
                    size={44}
                    status={onlineUserIds.has(e.friend.id) ? "online" : "offline"}
                  />
                  <div>
                    <div className={styles.friendName}>{e.friend.username}</div>
                    <div className={styles.pendingLabel}>En attente…</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Mes amis</h4>
        {accepted.length > 0 ? (
          <ul className={styles.list}>
            {accepted.map((e) => (
              <li key={e.friendshipId} className={styles.listItem}>
                <div className={styles.friendInfo}>
                  <PlayerAvatarBadge
                    name={e.friend.username}
                    size={44}
                    status={onlineUserIds.has(e.friend.id) ? "online" : "offline"}
                  />
                  <span className={styles.friendName}>{e.friend.username}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.emptyState}>Aucun ami pour l'instant.</div>
        )}
      </div>
    </div>
  );
}
