-- Individual (1-on-1) lesson support on ClassSession.
-- All changes are additive / relaxing, so every existing GROUP row stays valid:
--   * groupId becomes nullable (existing rows keep their non-null groupId).
--   * new columns are nullable or carry a default matching current behavior.

-- DropForeignKey (recreated below as nullable-safe)
ALTER TABLE "ClassSession" DROP CONSTRAINT "ClassSession_groupId_fkey";

-- AlterTable
ALTER TABLE "ClassSession"
  ALTER COLUMN "groupId" DROP NOT NULL,
  ADD COLUMN "type" TEXT NOT NULL DEFAULT 'GROUP',
  ADD COLUMN "studentId" TEXT,
  ADD COLUMN "pricePerLesson" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "ClassSession_studentId_idx" ON "ClassSession"("studentId");

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
