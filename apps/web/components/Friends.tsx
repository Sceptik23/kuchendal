"use client";

import { useEffect, useState } from "react";
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
    <div>
      <h3>Amis</h3>

      <input
        placeholder="Rechercher un pseudo…"
        value={query}
        onChange={(e) => void search(e.target.value)}
      />
      <ul>
        {results.map((u) => (
          <li key={u.id}>
            {u.username}{" "}
            <button
              onClick={() =>
                sendFriendRequest(userId, u.id).then(() => {
                  setResults((r) => r.filter((x) => x.id !== u.id));
                  void refresh();
                })
              }
            >
              Ajouter
            </button>
          </li>
        ))}
      </ul>

      {incoming.length > 0 && (
        <>
          <h4>Demandes reçues</h4>
          <ul>
            {incoming.map((e) => (
              <li key={e.friendshipId}>
                {e.friend.username}{" "}
                <button
                  onClick={() =>
                    respondToFriendRequest(e.friendshipId, "accepted").then(refresh)
                  }
                >
                  Accepter
                </button>
                <button
                  onClick={() => removeFriendship(e.friendshipId).then(refresh)}
                >
                  Refuser
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <h4>Demandes envoyées</h4>
          <ul>
            {outgoing.map((e) => (
              <li key={e.friendshipId}>{e.friend.username} (en attente)</li>
            ))}
          </ul>
        </>
      )}

      <h4>Mes amis</h4>
      <ul>
        {accepted.map((e) => (
          <li key={e.friendshipId}>
            {onlineUserIds.has(e.friend.id) ? "🟢" : "⚪"} {e.friend.username}
          </li>
        ))}
        {accepted.length === 0 && <li>Aucun ami pour l'instant.</li>}
      </ul>
    </div>
  );
}
