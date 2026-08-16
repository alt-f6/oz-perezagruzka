import { createHash } from "node:crypto";

// Optional pepper so hashed IPs stored in Postgres can't be reversed via a
// precomputed IPv4/IPv6 rainbow table even if the DB leaks. Safe to omit.
const IP_SALT = process.env.RATE_LIMIT_IP_SALT ?? "pz-ai-rate-limit";

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${IP_SALT}:${ip}`).digest("hex");
}

// `x-forwarded-for` can be spoofed by the client unless the platform's edge
// (e.g. Vercel) appends the true client IP as the *last* trusted hop and
// strips/overwrites anything the client sent. We take the first entry, which
// matches the existing behavior in readiness.ts's hashRequestIp and is
// correct for this app's deployment target (Vercel sets/overwrites
// x-forwarded-for at the edge before the request reaches the function).
export function extractClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  const first = forwardedFor?.split(",")[0]?.trim();
  if (first) return first;

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export function hashRequestHeaders(headers: Headers): string {
  return hashIp(extractClientIp(headers));
}
