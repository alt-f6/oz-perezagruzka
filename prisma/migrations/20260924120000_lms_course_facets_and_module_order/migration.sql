-- LMS admin redesign, phase 1 (docs/LMS_UI_PROPOSAL.md).

-- AlterTable: catalog facets on Course, inherited by its modules/lessons.
ALTER TABLE "Course" ADD COLUMN     "examType" TEXT,
ADD COLUMN     "grade" INTEGER,
ADD COLUMN     "subject" TEXT;

-- AlterTable: lets the admin dashboard show a "recently edited" feed.
ALTER TABLE "Lesson" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Course_teacherId_idx" ON "Course"("teacherId");

-- CreateIndex
CREATE INDEX "Course_examType_subject_idx" ON "Course"("examType", "subject");

-- Backfill: existing lessons were last edited no later than we can know.
UPDATE "Lesson" SET "updatedAt" = "createdAt";

-- Backfill: best-effort facets from the course title (the only place this
-- was recorded before). Only unambiguous exam markers are applied; anything
-- else stays NULL and is filled in from /admin/courses. Plain LIKE with both
-- capitalizations (not ILIKE) so Cyrillic matching doesn't depend on the
-- database's LC_CTYPE.
UPDATE "Course" SET "examType" = 'EGE'
WHERE "title" LIKE '%ЕГЭ%' AND "title" NOT LIKE '%ОГЭ%';

UPDATE "Course" SET "examType" = 'OGE'
WHERE "title" LIKE '%ОГЭ%' AND "title" NOT LIKE '%ЕГЭ%';

UPDATE "Course" SET "subject" = CASE
  WHEN "title" LIKE '%Математик%' OR "title" LIKE '%математик%' THEN 'Математика'
  WHEN "title" LIKE '%Русск%' OR "title" LIKE '%русск%' THEN 'Русский язык'
  WHEN "title" LIKE '%Информатик%' OR "title" LIKE '%информатик%' THEN 'Информатика'
  WHEN "title" LIKE '%Обществ%' OR "title" LIKE '%обществ%' THEN 'Обществознание'
  WHEN "title" LIKE '%Физик%' OR "title" LIKE '%физик%' THEN 'Физика'
  WHEN "title" LIKE '%Хими%' OR "title" LIKE '%хими%' THEN 'Химия'
  WHEN "title" LIKE '%Биолог%' OR "title" LIKE '%биолог%' THEN 'Биология'
  WHEN "title" LIKE '%Географ%' OR "title" LIKE '%географ%' THEN 'География'
  WHEN "title" LIKE '%Англ%' OR "title" LIKE '%англ%' THEN 'Английский'
  WHEN "title" LIKE '%Истори%' OR "title" LIKE '%истори%' THEN 'История'
  WHEN "title" LIKE '%Литератур%' OR "title" LIKE '%литератур%' THEN 'Литература'
  ELSE NULL
END;

-- Lesson.order used to be a global counter across the whole table. Renumber
-- 1..N within each module, preserving the existing relative order (the same
-- [order, id] sort every reader already uses).
UPDATE "Lesson" AS l
SET "order" = r.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "moduleId" ORDER BY "order", "id") AS rn
  FROM "Lesson"
) AS r
WHERE l."id" = r."id";
