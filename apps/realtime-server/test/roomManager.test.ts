import { describe, expect, it } from "vitest";
import { RoomManager } from "../src/rooms/RoomManager.js";

describe("RoomManager — creating and finding rooms", () => {
  it("creates a room and returns a short, findable code", () => {
    const manager = new RoomManager();
    const { code } = manager.createRoom({ type: "public" });

    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(manager.getRoom(code)).toBeDefined();
  });

  it("returns undefined for an unknown code", () => {
    const manager = new RoomManager();
    expect(manager.getRoom("ZZZZZZ")).toBeUndefined();
  });

  it("generates distinct codes for distinct rooms", () => {
    const manager = new RoomManager();
    const a = manager.createRoom({ type: "public" });
    const b = manager.createRoom({ type: "public" });
    expect(a.code).not.toBe(b.code);
  });
});

describe("RoomManager — joining a password-protected room", () => {
  it("rejects joining without the correct password", () => {
    const manager = new RoomManager();
    const { code } = manager.createRoom({ type: "password", password: "secret" });

    expect(() => manager.authorizeJoin(code)).toThrow(/password/i);
    expect(() => manager.authorizeJoin(code, "wrong")).toThrow(/password/i);
  });

  it("allows joining with the correct password", () => {
    const manager = new RoomManager();
    const { code } = manager.createRoom({ type: "password", password: "secret" });

    expect(() => manager.authorizeJoin(code, "secret")).not.toThrow();
  });

  it("throws when joining a code that doesn't exist", () => {
    const manager = new RoomManager();
    expect(() => manager.authorizeJoin("ZZZZZZ")).toThrow(/not found|unknown/i);
  });

  it("public and private rooms need no password", () => {
    const manager = new RoomManager();
    const pub = manager.createRoom({ type: "public" });
    const priv = manager.createRoom({ type: "private" });

    expect(() => manager.authorizeJoin(pub.code)).not.toThrow();
    expect(() => manager.authorizeJoin(priv.code)).not.toThrow();
  });
});

describe("RoomManager — listing public rooms", () => {
  it("only lists public rooms, never private or password-protected ones", () => {
    const manager = new RoomManager();
    const pub = manager.createRoom({ type: "public" });
    manager.createRoom({ type: "private" });
    manager.createRoom({ type: "password", password: "x" });

    const listing = manager.listPublicRooms();

    expect(listing).toHaveLength(1);
    expect(listing[0]!.code).toBe(pub.code);
  });

  it("includes a live player count and status in the listing", () => {
    const manager = new RoomManager();
    const { code, room } = manager.createRoom({ type: "public" });
    room.join("alice");
    room.join("bob");

    const listing = manager.listPublicRooms();
    expect(listing.find((r) => r.code === code)).toEqual({
      code,
      playerCount: 2,
      status: "lobby",
    });
  });
});
