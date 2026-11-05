import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/server/shared/schema.ts";

export type RawQuery = (sql: string, params: unknown[]) => Promise<unknown[][]>;

/** Adapt D1's array-format results to Drizzle's sqlite-proxy protocol. */
export function createD1Proxy(query: RawQuery) {
  return drizzle(async (sql, params, method) => {
    const rows = await query(sql, params);
    return { rows: (method === "get" ? rows[0] : rows) as unknown[] };
  }, { schema });
}

export function remoteD1Query(accountId: string, databaseId: string, token: string): RawQuery {
  return async (sql, params) => {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/raw`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    });
    const result = await response.json() as { success: boolean; result?: { success: boolean; results?: { rows?: unknown[][] } }[] };
    if (!response.ok || !result.success || !result.result?.[0]?.success) throw new Error("Cloudflare D1 query failed");
    return result.result[0].results?.rows ?? [];
  };
}
