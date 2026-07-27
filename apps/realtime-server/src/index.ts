import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { GAME_ENGINE_VERSION } from "@kuhhandel/game-engine";
import { createSocketServer } from "./socketServer.js";
import { RoomManager } from "./rooms/RoomManager.js";
import { NullPersistenceAdapter, type GamePersistenceAdapter } from "./persistence/types.js";
import { SupabasePersistenceAdapter } from "./persistence/SupabasePersistenceAdapter.js";
import { noopVerifier, type UserVerifier } from "./auth/verifyUser.js";
import { createSupabaseUserVerifier } from "./auth/SupabaseUserVerifier.js";

export function serverInfo() {
  return { engineVersion: GAME_ENGINE_VERSION };
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  if (existsSync(".env")) process.loadEnvFile(".env");

  const port = Number(process.env["PORT"] ?? 4000);
  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const anonKey = process.env["SUPABASE_ANON_KEY"];

  const persistence: GamePersistenceAdapter =
    supabaseUrl && serviceRoleKey
      ? new SupabasePersistenceAdapter(supabaseUrl, serviceRoleKey)
      : new NullPersistenceAdapter();

  const verifyUser: UserVerifier =
    supabaseUrl && anonKey ? createSupabaseUserVerifier(supabaseUrl, anonKey) : noopVerifier;

  if (!(supabaseUrl && serviceRoleKey)) {
    console.warn("[persistence] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — history will not be saved.");
  }
  if (!(supabaseUrl && anonKey)) {
    console.warn("[auth] SUPABASE_URL/SUPABASE_ANON_KEY not set — all players will join as guests.");
  }

  const httpServer = createServer();
  const roomManager = new RoomManager(() => persistence);
  createSocketServer(httpServer, roomManager, verifyUser);
  httpServer.listen(port, () => {
    console.log(`Kuhhandel realtime server listening on :${port}`);
  });
}
