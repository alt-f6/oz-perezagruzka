-- Lesson: dedicated interactive practice/workshop link (Miro board, Google Doc,
-- simulator, external test), kept separate from LessonMedia's video links so
-- the two never collide in the admin editor or student viewer. Both nullable
-- since most lessons won't set one.
ALTER TABLE "Lesson" ADD COLUMN "practiceLinkUrl" TEXT;
ALTER TABLE "Lesson" ADD COLUMN "practiceLinkLabel" TEXT;
