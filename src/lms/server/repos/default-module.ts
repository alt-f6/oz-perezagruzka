import { db } from "@/shared/lib/db";

// Lesson admin UX historically had no course/module picker, so every lesson
// landed in one implicit course/module (renamed to "Месяц 1: Вводный" by
// scripts/lms/migrate-default-module-to-month-one.ts once modules become a
// first-class admin concept — see Task 8). This stays as the fallback used
// when a lesson is created without an explicit moduleId.
export const DEFAULT_COURSE_TITLE = "Общий курс";
const DEFAULT_MODULE_TITLE = "Уроки";

export async function getDefaultModuleId(ownerUserId: string): Promise<string> {
  const existing = await db.module.findFirst({
    where: { course: { title: DEFAULT_COURSE_TITLE } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const course = await db.course.create({
    data: {
      title: DEFAULT_COURSE_TITLE,
      teacherId: ownerUserId,
      modules: { create: { title: DEFAULT_MODULE_TITLE, order: 0 } },
    },
    include: { modules: true },
  });

  return course.modules[0].id;
}
