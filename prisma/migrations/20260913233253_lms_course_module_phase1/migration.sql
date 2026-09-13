-- CreateEnum
CREATE TYPE "ModuleUnlockMode" AS ENUM ('MANUAL', 'DRIP_ENROLLMENT', 'FIXED_DATE');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'COMPLETED');

-- AlterTable Module
ALTER TABLE "Module" ADD COLUMN "description" TEXT,
ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "unlockMode" "ModuleUnlockMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "unlockAfterDays" INTEGER,
ADD COLUMN "unlockAt" TIMESTAMP(3);

-- AlterTable Lesson
ALTER TABLE "Lesson" ADD COLUMN "presentationEmbedUrl" TEXT,
ADD COLUMN "homeworkTask" TEXT;

-- AlterTable Enrollment
ALTER TABLE "Enrollment" ADD COLUMN "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "Enrollment_courseId_status_idx" ON "Enrollment"("courseId", "status");
