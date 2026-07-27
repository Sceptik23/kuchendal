import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

interface PresenceStore {
  onlineUserIds: Set<string>;
  channel: RealtimeChannel | null;
  start: (userId: string, username: string) => void;
}

/**
 * Simplified presence (02_PRD_PRODUCT.md §2 wants En ligne/En partie/Absent/
 * dernière connexion): this only tracks a single "online" boolean via a
 * Supabase Realtime Presence channel shared by every connected client.
 * "En partie" and "Absent" (idle detection) are deferred — worth a
 * dedicated pass once the lobby list itself carries per-player status.
 */
export const usePresenceStore = create<PresenceStore>((set, get) => ({
  onlineUserIds: new Set(),
  channel: null,

  start: (userId, username) => {
    if (get().channel) return; // already tracking

    const channel = supabase.channel("online-users", {
      config: { presence: { key: userId } },
    });

    channel.on("presence", { event: "sync" }, () => {
      set({ onlineUserIds: new Set(Object.keys(channel.presenceState())) });
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ username, online_at: new Date().toISOString() });
      }
    });

    set({ channel });
  },
}));
