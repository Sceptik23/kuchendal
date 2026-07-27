import { describe, expect, it } from "vitest";
import { GAME_ENGINE_VERSION } from "../src/index.js";

describe("game-engine package scaffold", () => {
  it("exposes a version export", () => {
    expect(GAME_ENGINE_VERSION).toBe("0.0.0");
  });
});
