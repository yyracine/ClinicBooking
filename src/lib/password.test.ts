import { describe, expect, it } from "vitest";
import { hashPassword, randomSalt, sha256Hex, verifyPassword } from "./password";

describe("sha256Hex", () => {
  it("returns a 64-character lowercase hex digest", async () => {
    const digest = await sha256Hex("hello");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    // Known SHA-256 of "hello" (RFC 6234 test vector).
    expect(digest).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});

describe("randomSalt", () => {
  it("returns a 32-character hex salt (128 bits)", () => {
    expect(randomSalt()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("produces distinct salts on repeated calls", () => {
    const salts = new Set(Array.from({ length: 50 }, () => randomSalt()));
    expect(salts.size).toBe(50);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("round-trips: the correct password verifies", async () => {
    const { hash, salt } = await hashPassword("secret123");
    expect(await verifyPassword("secret123", salt, hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const { hash, salt } = await hashPassword("secret123");
    expect(await verifyPassword("wrong-pass", salt, hash)).toBe(false);
  });

  it("returns false when salt or hash is missing", async () => {
    expect(await verifyPassword("x", undefined, undefined)).toBe(false);
    expect(await verifyPassword("x", "salt", undefined)).toBe(false);
    expect(await verifyPassword("x", undefined, "hash")).toBe(false);
  });

  it("returns false when the stored hash has a different length", async () => {
    const { hash, salt } = await hashPassword("secret123");
    expect(await verifyPassword("secret123", salt, hash.slice(0, -2))).toBe(
      false,
    );
  });

  it("uses a fresh salt per hash (same password, different digests)", async () => {
    const a = await hashPassword("secret123");
    const b = await hashPassword("secret123");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    // Each digest stays verifiable with its own salt.
    expect(await verifyPassword("secret123", a.salt, a.hash)).toBe(true);
    expect(await verifyPassword("secret123", b.salt, b.hash)).toBe(true);
  });
});
