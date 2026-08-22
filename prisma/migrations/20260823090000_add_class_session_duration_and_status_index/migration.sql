-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 60;

-- CreateIndex
CREATE INDEX "ClassSession_status_scheduledAt_idx" ON "ClassSession"("status", "scheduledAt");
