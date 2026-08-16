import { headers } from "next/headers";

/**
 * Subdomains that route the monorepo's apps (see proxy.ts `resolveApp`):
 * crm.<host> / lms.<host>, with the bare host serving the landing app.
 */
export type AppTarget = "landing" | "crm" | "lms";

const ENV_FALLBACKS: Record<AppTarget, string | undefined> = {
  landing: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL,
  crm: process.env.NEXT_PUBLIC_CRM_URL,
  lms: process.env.NEXT_PUBLIC_LMS_URL,
};

const DEFAULT_ORIGINS: Record<AppTarget, string> = {
  landing: "http://localhost:3000",
  crm: "http://crm.localhost:3000",
  lms: "http://lms.localhost:3000",
};

function stripAppSubdomain(hostname: string): string {
  return hostname.replace(/^(crm|lms)\./, "");
}

/**
 * Resolves the origin for `app` from the inbound request's Host header
 * (falling back to env vars, then hardcoded localhost defaults), so links
 * built during SSR/server actions always carry the caller's real
 * domain/port instead of a hardcoded or missing one.
 */
async function resolveOrigin(app: AppTarget): Promise<string> {
  try {
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host");

    if (host) {
      const protoHeader = headerList.get("x-forwarded-proto");
      const protocol =
        protoHeader?.split(",")[0]?.trim() ||
        (host.includes("localhost") ? "http" : "https");

      const [hostname, port] = host.split(":");
      const rootHostname = stripAppSubdomain(hostname);
      const targetHostname = app === "landing" ? rootHostname : `${app}.${rootHostname}`;
      const targetHost = port ? `${targetHostname}:${port}` : targetHostname;

      return `${protocol}://${targetHost}`;
    }
  } catch {
    // headers() throws outside a request scope (e.g. background jobs), so fall through.
  }

  return ENV_FALLBACKS[app] || DEFAULT_ORIGINS[app];
}

/**
 * Builds an absolute URL targeting a specific app's subdomain. Always use
 * this on the server for links dispatched externally (emails, invite
 * tokens): relative paths and `window.location` both break once the link
 * leaves the app that generated it.
 */
export async function buildAbsoluteUrl(app: AppTarget, path: string): Promise<string> {
  const origin = await resolveOrigin(app);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
}
