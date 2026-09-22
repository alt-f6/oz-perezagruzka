import type { MetadataRoute } from "next";
import { headers } from "next/headers";

const SITE_URL = "https://perezagruzka-edu.ru";

// Mirrors proxy.ts's resolveApp() host check in miniature. Not imported from
// proxy.ts on purpose -- that file is the auth-critical routing/session gate
// and this SEO-only file shouldn't be coupled to it for a 3-line check.
function isCrawlableHost(host: string): boolean {
  const hostname = host.split(":")[0] ?? "";
  return !hostname.startsWith("crm.") && !hostname.startsWith("lms.");
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";

  if (!isCrawlableHost(host)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/login", "/api/auth/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
