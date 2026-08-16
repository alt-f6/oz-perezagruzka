import type { PoolConfig } from "pg";

type PostgresRuntimeConfig = Pick<PoolConfig, "connectionString" | "ssl">;

type RuntimeConfigContext = "pool" | "prisma";

declare global {
  var __dbTlsRuntimeLog: Set<string> | undefined;
}

const SSL_QUERY_PARAM_NAMES = [
  "sslcert",
  "sslkey",
  "sslrootcert",
  "sslmode",
  "sslcrl",
];

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function getRequiredDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing");
  }

  return databaseUrl;
}

function sanitizeConnectionString(databaseUrl: string) {
  const url = new URL(databaseUrl);
  let removedSslParams = false;

  for (const name of SSL_QUERY_PARAM_NAMES) {
    if (url.searchParams.has(name)) {
      url.searchParams.delete(name);
      removedSslParams = true;
    }
  }

  return {
    connectionString: url.toString(),
    removedSslParams,
  };
}

function decodePgCaCert() {
  const raw = process.env.PG_CA_CERT_B64?.trim();
  if (!raw) {
    return undefined;
  }

  if (raw.includes("-----BEGIN CERTIFICATE-----")) {
    throw new Error(
      "PG_CA_CERT_B64 must be base64-encoded PEM certificate content, not raw PEM text.",
    );
  }

  const normalizedBase64 = raw.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(normalizedBase64)) {
    throw new Error("PG_CA_CERT_B64 is malformed: expected valid base64 content.");
  }

  const ca = Buffer.from(normalizedBase64, "base64")
    .toString("utf8")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!ca.includes("-----BEGIN CERTIFICATE-----")) {
    throw new Error(
      "PG_CA_CERT_B64 is invalid: decoded value is missing BEGIN CERTIFICATE.",
    );
  }

  if (!ca.includes("-----END CERTIFICATE-----")) {
    throw new Error(
      "PG_CA_CERT_B64 is invalid: decoded value is missing END CERTIFICATE.",
    );
  }

  return `${ca}\n`;
}

function logRuntimeTlsConfig(context: RuntimeConfigContext, sslEnabled: boolean) {
  const loggedContexts =
    globalThis.__dbTlsRuntimeLog ?? (globalThis.__dbTlsRuntimeLog = new Set());

  if (loggedContexts.has(context)) {
    return;
  }

  loggedContexts.add(context);

  console.info(`[db:${context}] PostgreSQL runtime TLS config`, {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasDirectUrl: Boolean(process.env.DIRECT_URL),
    hasPgCaCert: Boolean(process.env.PG_CA_CERT_B64?.trim()),
    sslEnabled,
  });
}

export function getPostgresRuntimeConfig(
  context: RuntimeConfigContext,
): PostgresRuntimeConfig {
  const databaseUrl = getRequiredDatabaseUrl();
  const prod = isProduction();
  const { connectionString } = sanitizeConnectionString(databaseUrl);

  const ca = decodePgCaCert();
  const ssl = prod
    ? ca
      ? {
          ca,
          rejectUnauthorized: true as const,
        }
      : {
          rejectUnauthorized: true as const,
        }
    : false;

  logRuntimeTlsConfig(context, ssl !== false);

  return {
    connectionString,
    ssl,
  };
}
