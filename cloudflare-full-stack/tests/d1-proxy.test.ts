import { afterEach, describe, expect, it, vi } from "vitest";
import { remoteD1Query } from "../scripts/d1-proxy";

afterEach(() => vi.unstubAllGlobals());
describe("remote D1 raw client", () => {
  it("sends a parameterized query and reads array rows", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, result: [{ success: true, results: { rows: [["one", 2]] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const query = remoteD1Query("account", "database", "token");
    expect(await query("SELECT ?", ["one"])).toEqual([["one", 2]]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/account/d1/database/database/raw");
    expect(init.headers.Authorization).toBe("Bearer token");
    expect(JSON.parse(init.body)).toEqual({ sql: "SELECT ?", params: ["one"] });
  });
  it("does not treat a D1 API failure as success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, result: [] }), { status: 403 })));
    await expect(remoteD1Query("a", "b", "c")("SELECT 1", [])).rejects.toThrow("Cloudflare D1 query failed");
  });
});
