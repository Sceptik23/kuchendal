/**
 * Resolves a client-supplied Supabase access token to a real, verified
 * user id. Never trust a client-supplied user id directly — a malicious
 * client could otherwise claim any identity and pollute someone else's
 * game history (03_ARCHITECTURE.md §7: validate every client action
 * server-side).
 */
export type UserVerifier = (accessToken: string | undefined) => Promise<string | null>;

export const noopVerifier: UserVerifier = async () => null;
