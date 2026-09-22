import type { MetadataRoute } from "next";

const SITE_URL = "https://perezagruzka-edu.ru";
// Deterministic per system invariants: never `new Date()` here, so the
// sitemap doesn't churn on every request/build. Bump by hand on release.
const BUILD_DATE = "2026-09-20T00:00:00.000Z";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: BUILD_DATE,
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...["/oge", "/ege"].map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...["/surgut", "/nizhnevartovsk", "/khanty-mansiysk"].map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...["/terms", "/privacy", "/pep"].map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
}
