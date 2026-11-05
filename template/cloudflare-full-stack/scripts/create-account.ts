import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { resolve } from "node:path";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { createD1Proxy, remoteD1Query } from "./d1-proxy.ts";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import * as schema from "../src/server/shared/schema.ts";
import { LOCAL_DATABASE_ID, requireRemoteTarget } from "./target.ts";

// This private CLI has its own Better Auth instance. No admin routes are mounted by the Worker.
const target = process.argv[2];
if (target !== "local" && target !== "remote") throw new Error("Specify local or remote");
if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Account creation requires an interactive terminal");
const remote = target === "remote" ? requireRemoteTarget() : null;
if (remote && !process.env.CLOUDFLARE_API_TOKEN) throw new Error("Set CLOUDFLARE_API_TOKEN with D1 write permission");

let muted = false;
const output = new Writable({ write(chunk, _encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); } });
const rl = createInterface({ input: process.stdin, output, terminal: true });
let email: string, name: string, password: string;
try {
  if (remote) {
    console.log(`REMOTE account creation: account ${remote.accountId}, database ${remote.databaseId}`);
    const confirm = await rl.question("Type the database ID to confirm: ");
    if (confirm !== remote.databaseId) throw new Error("Confirmation did not match");
  }
  email = (await rl.question("Email: ")).trim();
  name = (await rl.question("Name: ")).trim();
  process.stdout.write("Password (at least 8 characters): ");
  muted = true;
  password = await rl.question("");
  muted = false; process.stdout.write("\n");
  process.stdout.write("Confirm password: ");
  muted = true;
  const confirmation = await rl.question("");
  muted = false; process.stdout.write("\n");
  if (!name || !email || password.length < 8 || password !== confirmation) throw new Error("Invalid name, email or password confirmation");
} finally {
  muted = false;
  rl.close();
}

let mf: Miniflare | undefined;
try {
  let db;
  if (!remote) {
    mf = new Miniflare(convertV4MiniflareOptions({
      modules: true, script: "export default { fetch() { return new Response('') } }",
      compatibilityDate: "2026-10-06", d1Databases: { DB: LOCAL_DATABASE_ID },
      resourcePersistencePath: resolve(".cloudflare/state/v3"),
    }));
    const d1 = await mf.getD1Database("DB");
    db = drizzleD1(d1 as unknown as D1Database, { schema });
  } else {
    db = createD1Proxy(remoteD1Query(remote.accountId, remote.databaseId, process.env.CLOUDFLARE_API_TOKEN!));
  }
  const auth = betterAuth({
    secret: randomBytes(32).toString("hex"), baseURL: "http://localhost",
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: { enabled: true, disableSignUp: true },
    plugins: [admin()],
  });
  await auth.api.createUser({ body: { email, name, password, role: "user" } });
  console.log("Account created. Public sign-up remains disabled.");
} catch (error) {
  console.error("Account creation failed. Check the migration and target database; if interrupted, check for a partially created user before retrying.");
  throw error;
} finally {
  await mf?.dispose();
}
