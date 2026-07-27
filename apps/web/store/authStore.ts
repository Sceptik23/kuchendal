import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

interface Profile {
  id: string;
  username: string;
}

interface AuthStore {
  session: Session | null;
  profile: Profile | null;
  initializing: boolean;
  error: string | null;
  pendingConfirmation: boolean;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from("users").select("id, username").eq("id", userId).single();
  return data as Profile | null;
}

export const useAuthStore = create<AuthStore>((set) => {
  supabase.auth.getSession().then(async ({ data }) => {
    const session = data.session;
    const profile = session ? await loadProfile(session.user.id) : null;
    set({ session, profile, initializing: false });
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      set({ session: null, profile: null });
      return;
    }
    loadProfile(session.user.id).then((profile) => set({ session, profile }));
  });

  return {
    session: null,
    profile: null,
    initializing: true,
    error: null,
    pendingConfirmation: false,

    signUp: async (email, password, username) => {
      set({ error: null });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) {
        set({ error: error.message });
        return;
      }
      if (!data.session) {
        // Email confirmation required before a session is issued.
        set({ pendingConfirmation: true });
      }
    },

    signIn: async (email, password) => {
      set({ error: null });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) set({ error: error.message });
    },

    signOut: async () => {
      await supabase.auth.signOut();
    },

    clearError: () => set({ error: null }),
  };
});
