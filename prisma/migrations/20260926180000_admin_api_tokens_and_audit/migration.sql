-- Admin API: bearer tokens + audit journal (additive only, no FKs to existing tables).
-- Idempotent (IF NOT EXISTS) so it is safe on a database where these objects were
-- already created out-of-band via `prisma db execute` ahead of `migrate deploy`.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminToken" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenId" UUID,
    "endpoint" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "requestId" TEXT NOT NULL,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AdminToken_tokenHash_key" ON "AdminToken"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAuditLog_tokenId_createdAt_idx" ON "AdminAuditLog"("tokenId", "createdAt" DESC);
