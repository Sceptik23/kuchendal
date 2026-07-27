import { supabase } from "./supabaseClient";

export interface FriendshipRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  requested_by: string;
  status: "pending" | "accepted" | "blocked";
}

export interface UserSearchResult {
  id: string;
  username: string;
}

export async function searchUsersByUsername(query: string, excludeUserId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("id, username")
    .ilike("username", `%${query}%`)
    .neq("id", excludeUserId)
    .limit(10);
  if (error) throw error;
  return (data ?? []) as UserSearchResult[];
}

/**
 * The friendships table enforces user_a_id < user_b_id (one canonical row
 * per pair) — always sort the two ids before inserting.
 */
export async function sendFriendRequest(myUserId: string, otherUserId: string) {
  const [user_a_id, user_b_id] = [myUserId, otherUserId].sort();
  const { error } = await supabase
    .from("friendships")
    .insert({ user_a_id, user_b_id, requested_by: myUserId, status: "pending" });
  if (error) throw error;
}

export async function respondToFriendRequest(
  friendshipId: string,
  response: "accepted" | "blocked",
) {
  const { error } = await supabase
    .from("friendships")
    .update({ status: response })
    .eq("id", friendshipId);
  if (error) throw error;
}

export async function removeFriendship(friendshipId: string) {
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}

export interface FriendListEntry {
  friendshipId: string;
  status: "pending" | "accepted" | "blocked";
  requestedByMe: boolean;
  friend: UserSearchResult;
}

export async function listFriendships(myUserId: string): Promise<FriendListEntry[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, user_a_id, user_b_id, requested_by, status")
    .or(`user_a_id.eq.${myUserId},user_b_id.eq.${myUserId}`);
  if (error) throw error;

  const rows = (data ?? []) as FriendshipRow[];
  const otherIds = rows.map((r) => (r.user_a_id === myUserId ? r.user_b_id : r.user_a_id));
  if (otherIds.length === 0) return [];

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, username")
    .in("id", otherIds);
  if (usersError) throw usersError;
  const byId = new Map((users ?? []).map((u) => [u.id, u as UserSearchResult]));

  return rows.map((r) => {
    const otherId = r.user_a_id === myUserId ? r.user_b_id : r.user_a_id;
    return {
      friendshipId: r.id,
      status: r.status,
      requestedByMe: r.requested_by === myUserId,
      friend: byId.get(otherId) ?? { id: otherId, username: "?" },
    };
  });
}
