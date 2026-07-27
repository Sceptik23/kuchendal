import { createClient } from "@supabase/supabase-js";
import type { UserVerifier } from "./verifyUser.js";

export function createSupabaseUserVerifier(supabaseUrl: string, anonKey: string): UserVerifier {
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  return async (accessToken) => {
    if (!accessToken) return null;
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return data.user.id;
  };
}
