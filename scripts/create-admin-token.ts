/**
 * Issues a bearer token for the admin API (/api/admin/v1) and the remote MCP
 * server (/api/mcp). Only the SHA-256 hash is stored; the raw token is printed
 * exactly once -- copy it immediately, it cannot be recovered later.
 *
 * Run:
 *   npx tsx scripts/create-admin-token.ts --name "Claude (Lily)"
 *   npx tsx scripts/create-admin-token.ts --name "read-only" --scopes content:read,students:read
 *   npx tsx scripts/create-admin-token.ts --revoke <tokenId>
 */
import "dotenv/config";
import { db } from "@/shared/lib/db";
import { ADMIN_SCOPES, isAdminScope } from "@/shared/lib/admin-api/scopes";
import { generateAdminToken } from "@/shared/lib/admin-api/token";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function revoke(id: string) {
  const res = await db.adminToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  console.log(res.count ? `Token ${id} revoked.` : `No active token with id ${id}.`);
}

async function create() {
  const name = (argValue("--name") ?? "Claude (admin API)").trim();
  if (!name) throw new Error("--name must not be empty");

  const requested = argValue("--scopes")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [...ADMIN_SCOPES];
  const unknown = requested.filter((s) => !isAdminScope(s));
  if (unknown.length) throw new Error(`Unknown scope(s): ${unknown.join(", ")}. Allowed: ${ADMIN_SCOPES.join(", ")}`);
  const scopes = [...new Set(requested)];

  const { raw, hash } = generateAdminToken();
  const token = await db.adminToken.create({ data: { name, tokenHash: hash, scopes }, select: { id: true } });

  console.log("");
  console.log(`Admin token created: id=${token.id} name="${name}"`);
  console.log(`Scopes: ${scopes.join(", ")}`);
  console.log("");
  console.log("Raw token (shown ONCE, store it in a password manager):");
  console.log("");
  console.log(`  ${raw}`);
  console.log("");
}

async function main() {
  const revokeId = argValue("--revoke");
  if (revokeId) await revoke(revokeId);
  else await create();
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
