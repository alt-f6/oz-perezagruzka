-- LMS admin redesign, phase 2: course/module access management.
-- Existing enrollments keep full-course access (accessThroughModule NULL).

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "accessThroughModule" INTEGER,
ADD COLUMN     "sourceGroupId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Enrollment_sourceGroupId_idx" ON "Enrollment"("sourceGroupId");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sourceGroupId_fkey" FOREIGN KEY ("sourceGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
