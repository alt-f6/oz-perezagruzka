-- AlterTable
ALTER TABLE "User" ADD COLUMN "subjects" TEXT;
ALTER TABLE "User" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
