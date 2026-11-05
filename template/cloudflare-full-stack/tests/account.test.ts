import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../src/server/shared/schema";
import { createD1Proxy } from "../scripts/d1-proxy";

let mf: Miniflare;
let d1: Awaited<ReturnType<Miniflare["getD1Database"]>>;
beforeAll(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: "export default {fetch() {return new Response('ok')}}", compatibilityDate: "2026-10-06", d1Databases: { DB: "11111111-1111-4111-8111-111111111111" } }));
  d1 = await mf.getD1Database("DB");
  for (const file of ["0000_striped_selene.sql", "0001_black_leech.sql"]) {
    const sql = await readFile(`migrations/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) await d1.prepare(statement).run();
  }
});
afterAll(async () => { await mf?.dispose(); });

describe("operator-created accounts", () => {
  it("creates through the remote-style raw proxy and signs in through D1 while rejecting signup", async () => {
    const proxy = createD1Proxy(async (sql, params) => d1.prepare(sql).bind(...params).raw());
    const operator = betterAuth({ baseURL: "http://localhost", secret: "a-secure-test-secret-at-least-32-characters", database: drizzleAdapter(proxy, { provider: "sqlite", schema }), emailAndPassword: { enabled: true, disableSignUp: true }, plugins: [admin()] });
    const email = "account@example.invalid", password = "example-password-1234";
    const result = await operator.api.createUser({ body: { name: "Test", email, password, role: "user" } });
    expect(result.user.email).toBe(email);
    const app = betterAuth({ baseURL: "http://localhost", secret: "a-secure-test-secret-at-least-32-characters", database: drizzleAdapter(drizzle(d1 as unknown as D1Database, { schema }), { provider: "sqlite", schema }), emailAndPassword: { enabled: true, disableSignUp: true } });
    const login = await app.api.signInEmail({ body: { email, password } });
    expect(login.user.email).toBe(email);
    await expect(app.api.signUpEmail({ body: { email: "blocked@example.invalid", name: "Blocked", password } })).rejects.toThrow();
  });
});
