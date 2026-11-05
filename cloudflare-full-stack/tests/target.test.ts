import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCAL_DATABASE_ID, requireRemoteTarget } from "../scripts/target";
afterEach(() => vi.unstubAllEnvs());
describe("remote target safety", () => {
  it("rejects disabled TLS verification", () => {
    vi.stubEnv("NODE_TLS_REJECT_UNAUTHORIZED", "0");
    expect(() => requireRemoteTarget()).toThrow("TLS verification disabled");
  });
  it("rejects local ID and malformed account IDs", () => {
    vi.stubEnv("NODE_TLS_REJECT_UNAUTHORIZED", "1");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "not-an-id");
    vi.stubEnv("CLOUDFLARE_D1_DATABASE_ID", LOCAL_DATABASE_ID);
    expect(() => requireRemoteTarget()).toThrow("CLOUDFLARE_D1_DATABASE_ID");
    vi.stubEnv("CLOUDFLARE_D1_DATABASE_ID", "22222222-2222-4222-8222-222222222222");
    expect(() => requireRemoteTarget()).toThrow("CLOUDFLARE_ACCOUNT_ID");
  });
  it("accepts an explicit valid remote target", () => {
    vi.stubEnv("NODE_TLS_REJECT_UNAUTHORIZED", "1");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    vi.stubEnv("CLOUDFLARE_D1_DATABASE_ID", "22222222-2222-4222-8222-222222222222");
    expect(requireRemoteTarget().databaseId).toBe("22222222-2222-4222-8222-222222222222");
  });
});
