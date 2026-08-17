import { describe, expect, it } from "vitest";
import { mintToken } from "./token";

describe("mintToken", () => {
  it("returns a 64-character hex token and its sha256 hash", () => {
    const { token, tokenHash } = mintToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).not.toBe(token);
  });
});
