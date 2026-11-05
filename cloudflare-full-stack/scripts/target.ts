export const LOCAL_DATABASE_ID = "11111111-1111-4111-8111-111111111111";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function requireRemoteTarget() {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("Refusing remote operation with TLS verification disabled");
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!databaseId || !UUID.test(databaseId) || databaseId === LOCAL_DATABASE_ID) throw new Error("Set a valid remote CLOUDFLARE_D1_DATABASE_ID");
  if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) throw new Error("Set a valid CLOUDFLARE_ACCOUNT_ID");
  return { databaseId, accountId };
}
