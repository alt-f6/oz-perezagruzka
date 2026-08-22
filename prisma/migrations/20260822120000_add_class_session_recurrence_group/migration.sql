-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN "recurrenceGroupId" TEXT;

-- CreateIndex
CREATE INDEX "ClassSession_recurrenceGroupId_idx" ON "ClassSession"("recurrenceGroupId");
