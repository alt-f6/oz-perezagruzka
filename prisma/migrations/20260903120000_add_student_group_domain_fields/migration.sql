-- Student: denormalized parent contact, operational comment, and educational
-- domain fields. All nullable so existing rows are preserved (no data loss).
ALTER TABLE "Student" ADD COLUMN "parentName" TEXT;
ALTER TABLE "Student" ADD COLUMN "parentPhone" TEXT;
ALTER TABLE "Student" ADD COLUMN "comment" TEXT;
ALTER TABLE "Student" ADD COLUMN "grade" INTEGER;
ALTER TABLE "Student" ADD COLUMN "examType" TEXT;
ALTER TABLE "Student" ADD COLUMN "subject" TEXT;

-- Group: educational domain fields, nullable for backward compatibility.
ALTER TABLE "Group" ADD COLUMN "subject" TEXT;
ALTER TABLE "Group" ADD COLUMN "grade" INTEGER;
ALTER TABLE "Group" ADD COLUMN "examType" TEXT;
