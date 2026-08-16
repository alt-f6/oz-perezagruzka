import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 evaluates this file before loading any .env, so load it ourselves
// first. `url` no longer lives in schema.prisma; Migrate/introspect read the
// connection string from here, while the runtime client gets its own adapter
// in src/shared/lib/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
