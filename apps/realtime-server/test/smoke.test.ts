import { describe, expect, it } from "vitest";
import { serverInfo } from "../src/index.js";

describe("realtime-server scaffold", () => {
  it("can import the game engine package", () => {
    expect(serverInfo().engineVersion).toBe("0.0.0");
  });
});
