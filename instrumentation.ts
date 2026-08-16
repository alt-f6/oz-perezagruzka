// Runs once when a Next.js server instance boots (dev, `next start`, and
// serverless cold starts alike) -- https://nextjs.org/docs/app/guides/instrumentation
// Deliberately excludes the edge runtime: middleware there doesn't need
// DATABASE_URL/COOKIE_SECRET, and some Node APIs this validation could grow
// to depend on aren't available in edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/shared/lib/env");
    validateEnv();
  }
}
