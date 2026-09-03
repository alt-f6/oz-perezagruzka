-- Teacher weekly working availability (свободные окна). Purely additive: a new
-- table, no changes to existing rows or columns, so every prior migration and
-- row stays valid.
--
-- One row per (teacher, week). The 105 hourly slots (7 days × 15 hours,
-- 07:00–22:00 MSK) are packed into a fixed-length `slots` bitmask string of
-- '0'/'1'. A CHECK constraint enforces the exact shape at the DB layer,
-- mirroring the Zod validation, so a malformed payload can never persist.

-- CreateTable
CREATE TABLE "TeacherAvailability" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "slots" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAvailability_pkey" PRIMARY KEY ("id")
);

-- Domain integrity: exactly 105 characters, each '0' or '1'.
ALTER TABLE "TeacherAvailability"
    ADD CONSTRAINT "TeacherAvailability_slots_shape_check"
    CHECK ("slots" ~ '^[01]{105}$');

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAvailability_teacherId_weekStart_key" ON "TeacherAvailability"("teacherId", "weekStart");

-- CreateIndex
CREATE INDEX "TeacherAvailability_teacherId_weekStart_idx" ON "TeacherAvailability"("teacherId", "weekStart");

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
