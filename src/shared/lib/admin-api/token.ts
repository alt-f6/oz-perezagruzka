import { randomBytes } from "node:crypto";
import { hashAdminToken } from "./auth";

export const ADMIN_TOKEN_PREFIX = "pzg_admin_";

/**
 * 32 random bytes, base64url, with a recognizable prefix so a leaked token is
 * easy to spot in logs and secret scanners. Only `hash` is ever persisted.
 */
export function generateAdminToken(): { raw: string; hash: string } {
  const raw = `${ADMIN_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { raw, hash: hashAdminToken(raw) };
}
