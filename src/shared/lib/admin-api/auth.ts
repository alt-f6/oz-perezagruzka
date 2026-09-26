import { createHash } from "node:crypto";
import { db } from "@/shared/lib/db";
import { createLogger } from "@/shared/lib/logger";
import { forbiddenScope, unauthorized } from "./errors";
import type { AdminScope } from "./scopes";

const log = createLogger("admin-api:auth");

// lastUsedAt is bookkeeping, not security: writing it on every request would
// turn each read into a write and, under an MCP client's burst of tool calls,
// hog pool connections. Only touch it when it is unset or older than this.
export const LAST_USED_DEBOUNCE_MS = 60_000;

export interface AdminPrincipal {
  tokenId: string;
  name: string;
  scopes: string[];
}

export function hashAdminToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function extractBearerToken(headers: Headers): string | null {
  const header = headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}

export function assertScopes(principal: AdminPrincipal, required: readonly AdminScope[]): void {
  if (!required.every((scope) => principal.scopes.includes(scope))) throw forbiddenScope();
}

/**
 * Resolves the request's bearer token to an active AdminToken, then enforces
 * `required` scopes (all of them). Throws AdminApiError 401/403.
 */
export async function authenticateAdminRequest(
  headers: Headers,
  required: readonly AdminScope[] = [],
): Promise<AdminPrincipal> {
  const raw = extractBearerToken(headers);
  if (!raw) throw unauthorized();

  const token = await db.adminToken.findUnique({
    where: { tokenHash: hashAdminToken(raw) },
    select: { id: true, name: true, scopes: true, revokedAt: true, lastUsedAt: true },
  });
  if (!token || token.revokedAt !== null) throw unauthorized();

  const principal: AdminPrincipal = { tokenId: token.id, name: token.name, scopes: token.scopes };
  assertScopes(principal, required);

  const now = Date.now();
  if (!token.lastUsedAt || now - token.lastUsedAt.getTime() > LAST_USED_DEBOUNCE_MS) {
    // Fire-and-forget: a failed bookkeeping write must never fail the request.
    void db.adminToken
      .update({ where: { id: token.id }, data: { lastUsedAt: new Date(now) } })
      .catch((err: unknown) => log.warn("lastUsedAt update failed", { tokenId: token.id, error: String(err) }));
  }

  return principal;
}
