import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      // Deterministic wall-clock formatting (e.g. formatTimeRange) across
      // local/CI machines regardless of their configured timezone.
      TZ: "UTC",
      // Test HMAC secret for auth tests
      COOKIE_SECRET: "test-secret-must-be-at-least-32-chars-long-for-tests",
    },
    include: [
      "*.test.ts",
      "src/**/*.test.ts",
      "app/**/*.test.ts",
      "src/**/*.test.tsx",
      "app/**/*.test.tsx",
    ],
    environmentMatchGlobs: [
      ["src/**/*.test.tsx", "jsdom"],
      ["app/**/*.test.tsx", "jsdom"],
    ],
    setupFiles: ["./vitest-setup.ts"],
  },
  resolve: {
    alias: {
      "@/landing": fileURLToPath(new URL("./src/landing", import.meta.url)),
      "@/crm": fileURLToPath(new URL("./src/crm", import.meta.url)),
      "@/lms": fileURLToPath(new URL("./src/lms", import.meta.url)),
      "@/shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
    },
  },
});
