import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
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
