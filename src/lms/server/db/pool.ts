import { Pool } from "pg";
import { getPostgresRuntimeConfig } from "@/lms/server/db/runtime-config";

declare global {
  var __pgPool: Pool | undefined;
}

function buildPool(): Pool {
  return new Pool(getPostgresRuntimeConfig("pool"));
}

export function getPool(): Pool {
  if (!global.__pgPool) {
    global.__pgPool = buildPool();
  }
  return global.__pgPool;
}

export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    return getPool()[prop as keyof Pool];
  },
});
