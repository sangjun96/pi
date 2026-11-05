import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { LOCAL_DATABASE_ID, requireRemoteTarget } from "./target.ts";

const target = process.argv[2];
if (target !== "local" && target !== "remote") throw new Error("Specify local or remote");
let id = LOCAL_DATABASE_ID;
if (target === "remote") {
  const remote = requireRemoteTarget();
  id = remote.databaseId;
  if (!process.stdin.isTTY) throw new Error("Remote migrations require an interactive terminal");
  console.log(`REMOTE migration: account ${remote.accountId}, database ${id}`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Type the database ID to confirm: ");
  rl.close();
  if (answer !== id) throw new Error("Confirmation did not match");
}
const args = ["exec", "cf", "d1", "migrations", "apply", id, "--dir", "migrations"];
if (target === "local") args.push("--local", "--persist-to", ".cloudflare/state");
const result = spawnSync("pnpm", args, { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
