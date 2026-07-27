import { createServer } from "node:http";
import { GAME_ENGINE_VERSION } from "@kuhhandel/game-engine";
import { createSocketServer } from "./socketServer.js";
import { GameRoom } from "./room/GameRoom.js";

export function serverInfo() {
  return { engineVersion: GAME_ENGINE_VERSION };
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const port = Number(process.env["PORT"] ?? 4000);
  const httpServer = createServer();
  createSocketServer(httpServer, new GameRoom());
  httpServer.listen(port, () => {
    console.log(`Kuhhandel realtime server listening on :${port}`);
  });
}
